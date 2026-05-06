"""Phase 6 — Analytics + Domain Renewal + Reminders tests.

Uses direct Mongo access (motor) for setup/teardown of domain state and admin flag.
"""
import asyncio
import os
import time
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://aisite-builder-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

DEMO_EMAIL = "demo.pro@artisanweb.fr"
DEMO_PASSWORD = "demo1234"


def _api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _register(email, password, full_name="Test User"):
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "full_name": full_name}, timeout=20)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def mongo():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def demo_token():
    return _login(DEMO_EMAIL, DEMO_PASSWORD)


@pytest.fixture(scope="module")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def other_user(event_loop, mongo):
    email = f"TEST_other_{uuid.uuid4().hex[:8]}@example.com"
    token = _register(email, "testpass123", "Isolation Test")
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def admin_user(event_loop, mongo):
    email = f"TEST_admin_{uuid.uuid4().hex[:8]}@example.com"
    token = _register(email, "testpass123", "Admin Test")

    async def promote():
        # User emails are stored lowercased by the backend
        res = await mongo.users.update_one({"email": email.lower()}, {"$set": {"is_admin": True}})
        assert res.matched_count == 1, f"Failed to promote admin user {email.lower()}"

    event_loop.run_until_complete(promote())
    # re-login so the token already reflects, but admin_only relies on current_user lookup in DB — current token works
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def demo_domain(event_loop, mongo):
    """Ensure demo user has plombier-paris.fr active and expiring in ~25d."""
    async def setup():
        doc = await mongo.domains.find_one({"domain_name": "plombier-paris.fr"}, {"_id": 0})
        return doc
    doc = event_loop.run_until_complete(setup())
    assert doc, "plombier-paris.fr seed missing — run seed_demo_shop or check previous iteration"
    return doc


# ---------- Analytics ----------

class TestAnalytics:
    def test_analytics_summary_demo(self, demo_headers, demo_domain, event_loop, mongo):
        # Patch expiry to 25 days so it shows in expiring_soon
        async def patch():
            new_exp = (datetime.now(timezone.utc) + timedelta(days=25)).isoformat()
            await mongo.domains.update_one(
                {"domain_name": "plombier-paris.fr"},
                {"$set": {"expiry_date": new_exp, "reminders_sent": [], "status": "active"}},
            )
        event_loop.run_until_complete(patch())

        r = requests.get(f"{API}/analytics/summary", headers=demo_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["currency"] == "EUR"
        assert "sites_count" in data
        assert data["shops_count"] >= 1, f"expected shops_count>=1, got {data['shops_count']}"
        assert data["orders"]["total_count"] >= 1, f"expected at least 1 demo order, got {data['orders']}"
        assert data["orders"]["total_cents"] > 0
        assert data["orders"]["avg_basket_cents"] > 0
        assert isinstance(data["orders"]["top_products"], list)
        assert data["domains"]["active_count"] >= 1
        assert isinstance(data["domains"]["expiring_soon"], list)
        names = [d["domain_name"] for d in data["domains"]["expiring_soon"]]
        assert "plombier-paris.fr" in names, f"plombier-paris.fr should be in expiring_soon, got {names}"
        assert len(data["monthly_series"]) == 6
        for m in data["monthly_series"]:
            assert "month" in m and "shop_cents" in m and "domain_cents" in m and "total_cents" in m

    def test_analytics_isolation(self, other_user):
        r = requests.get(f"{API}/analytics/summary", headers=other_user["headers"], timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data["sites_count"] == 0
        assert data["shops_count"] == 0
        assert data["orders"]["total_count"] == 0
        assert data["orders"]["total_cents"] == 0
        assert data["domains"]["active_count"] == 0
        assert data["leads"]["total"] == 0

    def test_analytics_requires_auth(self):
        r = requests.get(f"{API}/analytics/summary", timeout=20)
        assert r.status_code in (401, 403)


# ---------- Auto-renew toggle ----------

class TestAutoRenew:
    def test_toggle_auto_renew(self, demo_headers, demo_domain):
        did = demo_domain["id"]
        r = requests.put(f"{API}/domains/{did}/auto-renew", headers=demo_headers, json={"auto_renew": True}, timeout=20)
        assert r.status_code == 200
        assert r.json()["auto_renew"] is True

        r = requests.put(f"{API}/domains/{did}/auto-renew", headers=demo_headers, json={"auto_renew": False}, timeout=20)
        assert r.status_code == 200
        assert r.json()["auto_renew"] is False

        # GET /domains to verify persistence
        r = requests.get(f"{API}/domains", headers=demo_headers, timeout=20)
        assert r.status_code == 200
        found = next((d for d in r.json() if d["id"] == did), None)
        assert found is not None
        assert found.get("auto_renew") is False

    def test_auto_renew_other_user_404(self, other_user, demo_domain):
        r = requests.put(f"{API}/domains/{demo_domain['id']}/auto-renew", headers=other_user["headers"], json={"auto_renew": True}, timeout=20)
        assert r.status_code == 404


# ---------- Renewal checkout ----------

class TestRenewal:
    def test_create_renewal_checkout(self, demo_headers, demo_domain, event_loop, mongo):
        did = demo_domain["id"]
        r = requests.post(
            f"{API}/domains/{did}/renew",
            headers=demo_headers,
            json={"origin_url": BASE_URL},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and data["url"].startswith("https://")
        assert "session_id" in data
        assert data["amount_cents"] > 0

        # Verify db.domain_renewals inserted
        async def check():
            doc = await mongo.domain_renewals.find_one({"stripe_session_id": data["session_id"]}, {"_id": 0})
            return doc
        doc = event_loop.run_until_complete(check())
        assert doc is not None
        assert doc["domain_id"] == did
        assert doc["payment_status"] == "initiated"
        assert doc["status"] == "pending"
        assert doc["amount_cents"] == data["amount_cents"]

        # Save for later tests via pytest module-scope dict
        pytest.renewal_session_id = data["session_id"]
        pytest.renewal_domain_id = did

    def test_renewal_other_user_404(self, other_user, demo_domain):
        r = requests.post(
            f"{API}/domains/{demo_domain['id']}/renew",
            headers=other_user["headers"],
            json={"origin_url": BASE_URL},
            timeout=20,
        )
        assert r.status_code == 404

    def test_apply_renewal_extends_expiry(self, event_loop, mongo, demo_domain):
        """Patch the renewal payment_status=paid, invoke _apply_domain_renewal_if_paid, verify expiry +365d and reminders_sent cleared."""
        session_id = getattr(pytest, "renewal_session_id", None)
        domain_id = getattr(pytest, "renewal_domain_id", None)
        assert session_id, "previous test did not set session id"

        async def run():
            # Capture current expiry
            dom_before = await mongo.domains.find_one({"id": domain_id})
            before_exp = dom_before["expiry_date"]
            # Patch reminders_sent to verify reset
            await mongo.domains.update_one({"id": domain_id}, {"$set": {"reminders_sent": ["30d"]}})
            await mongo.domain_renewals.update_one({"stripe_session_id": session_id}, {"$set": {"payment_status": "paid"}})
            # Import server's helper
            import sys
            sys.path.insert(0, "/app/backend")
            from server import _apply_domain_renewal_if_paid
            result = await _apply_domain_renewal_if_paid(session_id)
            dom_after = await mongo.domains.find_one({"id": domain_id})
            return before_exp, dom_after, result

        before_exp, dom_after, result = event_loop.run_until_complete(run())
        assert result is not None
        assert result["status"] == "applied", f"renewal not applied: {result}"
        # Expiry extended by ~365d
        before_dt = datetime.fromisoformat(before_exp)
        after_dt = datetime.fromisoformat(dom_after["expiry_date"])
        delta_days = (after_dt - before_dt).days
        assert 360 <= delta_days <= 370, f"expected ~365d extension, got {delta_days}d"
        # reminders_sent reset
        assert dom_after.get("reminders_sent") == []


# ---------- Domain Reminders Cron ----------

class TestReminders:
    def test_reminders_admin_only(self, demo_headers):
        r = requests.post(f"{API}/admin/cron/domain-reminders", headers=demo_headers, timeout=20)
        assert r.status_code == 403

    def test_reminders_sends_and_idempotent(self, admin_user, event_loop, mongo, demo_domain):
        did = demo_domain["id"]

        async def patch_5d():
            new_exp = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
            await mongo.domains.update_one(
                {"id": did},
                {"$set": {"expiry_date": new_exp, "reminders_sent": [], "status": "active"}},
            )
        event_loop.run_until_complete(patch_5d())

        # First call — should send
        r = requests.post(f"{API}/admin/cron/domain-reminders", headers=admin_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        payload = r.json()
        assert "sent" in payload and "errors" in payload
        sent_names = [s["domain_name"] for s in payload["sent"]]
        assert "plombier-paris.fr" in sent_names, f"expected plombier-paris.fr in sent, got {payload}"
        sent_entry = next(s for s in payload["sent"] if s["domain_name"] == "plombier-paris.fr")
        assert sent_entry["label"] == "7d", f"expected label=7d for 5 days_left, got {sent_entry['label']}"

        # Verify db.domains.reminders_sent updated
        async def check():
            doc = await mongo.domains.find_one({"id": did}, {"_id": 0, "reminders_sent": 1})
            return doc
        doc = event_loop.run_until_complete(check())
        assert "7d" in (doc.get("reminders_sent") or [])

        # Second call — idempotent (no re-send for same label)
        r2 = requests.post(f"{API}/admin/cron/domain-reminders", headers=admin_user["headers"], timeout=30)
        assert r2.status_code == 200
        payload2 = r2.json()
        names2 = [s["domain_name"] for s in payload2["sent"]]
        assert "plombier-paris.fr" not in names2, f"second call should be idempotent, got {payload2}"


# ---------- Webhook ----------

def test_webhook_empty_body():
    r = requests.post(f"{API}/webhook/stripe", data="", timeout=20)
    assert r.status_code == 200
