"""
ArtisanWeb Phase 2 backend pytest suite (P0/P1/P2):
- POST /api/sites/{id}/regenerate-logo  (one real Gemini call)
- POST /api/sites/{id}/regenerate-hero  (one real Gemini call)
- GET  /api/files/{path}                (object storage proxy, public)
- GET  /api/billing/me
- POST /api/billing/checkout (+ invalid package_id)
- GET  /api/billing/status/{session_id}
- Free tier enforcement (FREE_SITE_LIMIT=1) — 402 mentioning "Pro"
- PUT  /api/sites/{id} accepts custom_domain / show_map / map_address
- Lead email silent skip (verify lead saved when RESEND_API_KEY empty)
- Multi-tenant isolation: regenerate-logo, regenerate-hero, billing/status
"""
import os
import re
import uuid
import time
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Resolve backend URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"
TIMEOUT = 200  # generous: Gemini logo/hero calls can take 30-60s

def _read_backend_env(key):
    try:
        with open('/app/backend/.env') as f:
            for line in f:
                if line.startswith(f"{key}="):
                    v = line.split('=', 1)[1].strip()
                    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
                        v = v[1:-1]
                    return v
    except Exception:
        return None
    return None


MONGO_URL = _read_backend_env('MONGO_URL') or 'mongodb://localhost:27017'
DB_NAME = _read_backend_env('DB_NAME') or 'test_database'


def _rand_email(prefix="tester"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@artisanweb.fr"


def _register(prefix):
    email = _rand_email(prefix)
    pwd = "testpass123"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pwd, "full_name": f"{prefix} Phase2"
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": pwd, "token": data["access_token"], "user": data["user"]}


@pytest.fixture(scope="session")
def state():
    return {}


@pytest.fixture(scope="session")
def user_a(state):
    state['a'] = _register("ph2a")
    return state['a']


@pytest.fixture(scope="session")
def user_b(state):
    state['b'] = _register("ph2b")
    return state['b']


def _make_site(token, business_name="Phase2 Plomberie", city="Lyon"):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "business_name": business_name,
        "business_type": "Plomberie",
        "services": ["Dépannage"],
        "city": city,
        "phone": "0600000000",
        "generate_image": False,
    }
    r = requests.post(f"{API}/sites/generate", json=payload, headers=headers, timeout=TIMEOUT)
    return r


@pytest.fixture(scope="session")
def site_a(user_a, state):
    r = _make_site(user_a["token"], business_name="Phase2 Site A", city="Lyon")
    assert r.status_code == 200, r.text
    site = r.json()
    state['site_a'] = site
    return site


# ----- Billing -----
class TestBilling:
    def test_billing_me_free(self, user_a):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.get(f"{API}/billing/me", headers=h, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["plan"] == "free"
        assert d["site_limit"] == 1
        assert isinstance(d["packages"], dict)
        assert "pro_monthly" in d["packages"]
        assert "pro_yearly" in d["packages"]
        assert d["packages"]["pro_monthly"]["amount"] == 19.0
        assert d["packages"]["pro_monthly"]["currency"] == "eur"

    def test_billing_me_requires_auth(self):
        r = requests.get(f"{API}/billing/me", timeout=15)
        assert r.status_code == 401

    def test_billing_checkout_invalid_package(self, user_a):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.post(f"{API}/billing/checkout", headers=h, json={
            "package_id": "not_a_real_pkg", "origin_url": BASE_URL
        }, timeout=30)
        assert r.status_code == 400, r.text

    def test_billing_checkout_creates_session_and_txn(self, user_a, state):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.post(f"{API}/billing/checkout", headers=h, json={
            "package_id": "pro_monthly", "origin_url": BASE_URL
        }, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and d["url"].startswith("https://")
        assert "stripe.com" in d["url"]
        assert "session_id" in d and d["session_id"].startswith("cs_")
        state['session_id'] = d["session_id"]

    def test_billing_status_unpaid_for_initiated(self, user_a, state):
        sid = state.get('session_id')
        if not sid:
            pytest.skip("checkout did not produce session_id")
        h = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.get(f"{API}/billing/status/{sid}", headers=h, timeout=30)
        # After iteration 3 fix: _apply_pro_credit_if_paid wraps stripe SDK call in try/except
        # and returns a 200 with lookup_error=true when Stripe can't find the session.
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("payment_status") in ("unpaid", "no_payment_required", "initiated", "pending"), d
        assert d.get("applied") is False
        assert d.get("package_id") == "pro_monthly"
        # When Stripe SDK can't retrieve session (test key), lookup_error must be surfaced
        # so the frontend/client can distinguish from a real unpaid state.
        # If the underlying Stripe retrieve actually works (real key), lookup_error may be absent.
        if d.get("lookup_error") is not None:
            assert d["lookup_error"] is True

    def test_billing_status_other_user_404(self, user_b, state):
        sid = state.get('session_id')
        if not sid:
            pytest.skip("no session_id")
        h = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.get(f"{API}/billing/status/{sid}", headers=h, timeout=15)
        assert r.status_code == 404


# ----- Free tier enforcement -----
class TestFreeTier:
    def test_first_site_ok(self, site_a):
        assert site_a["id"]

    def test_second_site_402(self, user_a):
        r = _make_site(user_a["token"], business_name="Phase2 Site A2", city="Marseille")
        assert r.status_code == 402, r.text
        body = r.json()
        # French error mentioning "Pro"
        detail = body.get("detail", "")
        assert "Pro" in detail, detail
        assert "gratuit" in detail.lower() or "limite" in detail.lower(), detail


# ----- PUT /api/sites/{id} new fields -----
class TestSiteUpdateNewFields:
    def test_custom_domain_show_map_persists(self, user_a, site_a):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        body = {
            "custom_domain": "monsite.example.com",
            "show_map": True,
            "map_address": "10 rue de Lyon, 69000 Lyon, France",
        }
        r = requests.put(f"{API}/sites/{site_a['id']}", json=body, headers=h, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["custom_domain"] == body["custom_domain"]
        assert d["show_map"] is True
        assert d["map_address"] == body["map_address"]
        # persistence check
        r2 = requests.get(f"{API}/sites/{site_a['id']}", headers=h, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["custom_domain"] == body["custom_domain"]
        assert d2["show_map"] is True
        assert d2["map_address"] == body["map_address"]


# ----- Regenerate logo / hero (one of each, real Gemini) -----
class TestRegenerateAssets:
    @pytest.mark.timeout(180)
    def test_regenerate_logo(self, user_a, site_a, state):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        t0 = time.time()
        r = requests.post(f"{API}/sites/{site_a['id']}/regenerate-logo", headers=h, timeout=180)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"status={r.status_code} elapsed={elapsed:.1f}s body={r.text[:300]}"
        d = r.json()
        url = d.get("logo_url")
        assert url, f"no logo_url returned: {d}"
        # Should be served from object storage (not inline base64)
        assert url.startswith("/api/files/"), f"logo_url not from storage: {url[:120]} (elapsed={elapsed:.1f}s)"
        state['logo_url'] = url

    def test_files_endpoint_serves_logo(self, state):
        url = state.get('logo_url')
        if not url:
            pytest.skip("logo_url missing")
        full = f"{BASE_URL}{url}"
        r = requests.get(full, timeout=30)
        assert r.status_code == 200, r.text[:200]
        ct = r.headers.get("Content-Type", "")
        assert ct.startswith("image/"), f"unexpected content-type: {ct}"
        assert len(r.content) > 100, "image bytes too small"

    def test_files_endpoint_404_for_unknown(self):
        bogus = f"{API}/files/artisanweb/logo/nonexistent/{uuid.uuid4().hex}.png"
        r = requests.get(bogus, timeout=15)
        assert r.status_code == 404

    def test_files_endpoint_no_auth_required(self, state):
        url = state.get('logo_url')
        if not url:
            pytest.skip("no logo_url")
        # No Authorization header
        r = requests.get(f"{BASE_URL}{url}", timeout=30)
        assert r.status_code == 200

    @pytest.mark.timeout(180)
    def test_regenerate_hero(self, user_a, site_a, state):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        t0 = time.time()
        r = requests.post(f"{API}/sites/{site_a['id']}/regenerate-hero", headers=h, timeout=180)
        elapsed = time.time() - t0
        assert r.status_code == 200, f"status={r.status_code} elapsed={elapsed:.1f}s body={r.text[:300]}"
        d = r.json()
        url = d.get("hero_image_url")
        assert url, f"no hero_image_url: {d}"
        assert url.startswith("/api/files/"), f"hero not from storage: {url[:120]}"
        state['hero_url'] = url
        # Verify saved on site
        r2 = requests.get(f"{API}/sites/{site_a['id']}", headers=h, timeout=15)
        assert r2.json()["hero_image_url"] == url

    def test_regenerate_logo_other_user_404(self, user_b, site_a):
        h = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.post(f"{API}/sites/{site_a['id']}/regenerate-logo", headers=h, timeout=15)
        assert r.status_code == 404

    def test_regenerate_hero_other_user_404(self, user_b, site_a):
        h = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.post(f"{API}/sites/{site_a['id']}/regenerate-hero", headers=h, timeout=15)
        assert r.status_code == 404


# ----- Lead silent email skip -----
class TestLeadEmailSkip:
    def test_lead_saved_when_resend_key_empty(self, site_a):
        slug = site_a["slug"]
        r = requests.post(f"{API}/public/sites/{slug}/leads", json={
            "name": "TEST_Phase2 Client",
            "email": "TEST_phase2_lead@example.com",
            "phone": "0600000000",
            "message": "Phase 2 lead test — resend key empty, email should be silently skipped.",
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert "id" in d

    def test_lead_triggers_email_skipped_log(self, site_a):
        """After iteration 3 fix: submit_lead must fire-and-forget send_lead_notification_email
        which logs '[email skipped — no RESEND_API_KEY]' when RESEND_API_KEY is empty,
        and submit_lead itself logs 'Lead received for slug=...'. Both must appear in backend log."""
        slug = site_a["slug"]
        marker = f"TEST_logcheck_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/public/sites/{slug}/leads", json={
            "name": "TEST_LogCheck Client",
            "email": marker,
            "phone": "0600000000",
            "message": "Log-check lead — verifying both log lines are emitted.",
        }, timeout=15)
        assert r.status_code == 200, r.text
        # Give the fire-and-forget task a moment to log
        time.sleep(2)

        # Read supervisor-managed backend log
        log_paths = [
            "/var/log/supervisor/backend.err.log",
            "/var/log/supervisor/backend.out.log",
        ]
        combined = ""
        for p in log_paths:
            try:
                with open(p, "r") as f:
                    # read last ~200KB to stay fast
                    f.seek(0, 2)
                    size = f.tell()
                    f.seek(max(0, size - 200_000))
                    combined += f.read()
            except Exception:
                pass

        assert f"Lead received for slug={slug}" in combined, \
            f"'Lead received for slug={slug}' log line not found in backend logs"
        assert "email skipped" in combined and "RESEND_API_KEY" in combined, \
            "'[email skipped — no RESEND_API_KEY]' log line not found — send_lead_notification_email was not invoked"


# ----- Free-tier bypass via DB pro_until (validate it lifts the limit) -----
class TestProBypass:
    @pytest.mark.timeout(60)
    def test_pro_until_allows_more_sites(self, user_a):
        """Directly grant pro_until in DB and confirm the 402 limit is lifted."""
        async def _run():
            cli = AsyncIOMotorClient(MONGO_URL)
            try:
                from datetime import datetime, timezone, timedelta
                future = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
                await cli[DB_NAME].users.update_one({"id": user_a["user"]["id"]}, {"$set": {"pro_until": future}})
            finally:
                cli.close()
        asyncio.run(_run())

        # billing/me should now reflect pro
        h = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.get(f"{API}/billing/me", headers=h, timeout=15)
        assert r.status_code == 200
        assert r.json()["plan"] == "pro"

        # second site creation should now succeed
        r2 = _make_site(user_a["token"], business_name="Phase2 Pro Site", city="Nantes")
        assert r2.status_code == 200, r2.text


# ----- Cleanup: delete sites created by user_a -----
class TestZCleanup:
    def test_cleanup(self, user_a):
        h = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.get(f"{API}/sites", headers=h, timeout=15)
        if r.status_code == 200:
            for s in r.json():
                requests.delete(f"{API}/sites/{s['id']}", headers=h, timeout=15)
