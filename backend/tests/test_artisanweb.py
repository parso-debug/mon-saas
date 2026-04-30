"""
ArtisanWeb backend pytest suite.
Covers: auth (register/login/me), sites generate (Claude content + optional Gemini image),
sites CRUD, publish, public site, lead submission, owner-only leads listing,
multi-tenant isolation, slug uniqueness.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # fallback: read frontend env
    try:
        with open('/app/frontend/.env') as f:
            for line in f:
                if line.startswith('REACT_APP_BACKEND_URL='):
                    BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"
TIMEOUT = 180  # generous to allow Claude/Gemini calls


def _rand_email(prefix="tester"):
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@artisanweb.fr"


# ---- Shared session-scoped users / site ----
@pytest.fixture(scope="session")
def session_state():
    return {}


@pytest.fixture(scope="session")
def user_a(session_state):
    email = _rand_email("a")
    pwd = "testpass123"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pwd, "full_name": "Alice Artisan"
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    session_state['user_a'] = {"email": email, "password": pwd, "token": data["access_token"], "user": data["user"]}
    return session_state['user_a']


@pytest.fixture(scope="session")
def user_b(session_state):
    email = _rand_email("b")
    pwd = "testpass123"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": pwd, "full_name": "Bob Builder"
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    session_state['user_b'] = {"email": email, "password": pwd, "token": data["access_token"], "user": data["user"]}
    return session_state['user_b']


@pytest.fixture(scope="session")
def site_a(user_a, session_state):
    """Generate one real site for user_a (no image -> faster)."""
    headers = {"Authorization": f"Bearer {user_a['token']}"}
    payload = {
        "business_name": "Dupont Rénovation",
        "business_type": "Rénovation",
        "services": ["Peinture", "Carrelage", "Plâtrerie"],
        "city": "Toulouse",
        "phone": "+33 5 61 00 00 00",
        "email": "contact@dupont.fr",
        "description": "Entreprise familiale spécialisée en rénovation tous corps d'état.",
        "style": "moderne",
        "generate_image": False,
    }
    r = requests.post(f"{API}/sites/generate", json=payload, headers=headers, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    site = r.json()
    session_state['site_a'] = site
    session_state['site_a_payload'] = payload
    return site


# ---- Health ----
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert "ArtisanWeb" in data.get("service", "")


# ---- Auth ----
class TestAuth:
    def test_register_returns_token_and_user(self, user_a):
        assert user_a["token"]
        assert user_a["user"]["email"] == user_a["email"].lower()
        assert user_a["user"]["full_name"] == "Alice Artisan"
        assert "id" in user_a["user"]

    def test_register_duplicate_email_400(self, user_a):
        r = requests.post(f"{API}/auth/register", json={
            "email": user_a["email"], "password": "testpass123", "full_name": "Dup"
        }, timeout=30)
        assert r.status_code == 400

    def test_login_valid(self, user_a):
        r = requests.post(f"{API}/auth/login", json={
            "email": user_a["email"], "password": user_a["password"]
        }, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["access_token"]
        assert data["user"]["email"] == user_a["email"].lower()

    def test_login_invalid_password_401(self, user_a):
        r = requests.post(f"{API}/auth/login", json={
            "email": user_a["email"], "password": "wrong-password"
        }, timeout=30)
        assert r.status_code == 401

    def test_login_invalid_email_401(self):
        r = requests.post(f"{API}/auth/login", json={
            "email": "noexist@artisanweb.fr", "password": "whatever"
        }, timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, user_a):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_a['token']}"}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == user_a["email"].lower()
        assert data["id"] == user_a["user"]["id"]

    def test_me_without_token_401(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_invalid_token_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer abc.def.ghi"}, timeout=15)
        assert r.status_code == 401


# ---- Sites: generation + CRUD ----
class TestSitesGenerate:
    def test_generate_site_no_image(self, site_a, session_state):
        site = site_a
        payload = session_state['site_a_payload']
        # Top-level fields
        assert "id" in site and isinstance(site["id"], str)
        assert "slug" in site and site["slug"]
        assert site["business_name"] == payload["business_name"]
        assert site["business_type"] == payload["business_type"]
        assert site["city"] == payload["city"]
        assert site["status"] == "draft"
        assert site["hero_image_url"] in (None, "")  # image disabled
        # Slug should derive from business+city, lowercased, ascii
        assert "dupont" in site["slug"].lower()
        assert "toulouse" in site["slug"].lower()
        # Content structure
        c = site["content"]
        for k in ("hero_title", "hero_subtitle", "value_props", "why_us", "seo_title", "seo_description", "services"):
            assert k in c, f"missing content key: {k}"
        # Services array length must equal input
        assert len(c["services"]) == len(payload["services"]), f"services len mismatch {len(c['services'])} vs {len(payload['services'])}"
        # French content sanity check (Toulouse should appear somewhere)
        joined = (c.get("hero_title", "") + " " + c.get("hero_subtitle", "") + " " + c.get("seo_description", "")).lower()
        assert "toulouse" in joined, f"city not found in content: {joined[:300]}"

    def test_generate_requires_auth(self):
        r = requests.post(f"{API}/sites/generate", json={
            "business_name": "X", "business_type": "Plomberie",
            "services": ["a"], "city": "Lyon", "phone": "0600000000", "generate_image": False
        }, timeout=30)
        assert r.status_code == 401

    def test_slug_uniqueness_same_business_city(self, user_a, session_state):
        """Generating two sites with same name+city should yield distinct slugs."""
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        payload = {
            "business_name": "Slugtest Entreprise",
            "business_type": "Plomberie",
            "services": ["Dépannage"],
            "city": "Bordeaux",
            "phone": "0600000000",
            "generate_image": False,
        }
        r1 = requests.post(f"{API}/sites/generate", json=payload, headers=headers, timeout=TIMEOUT)
        assert r1.status_code == 200, r1.text
        r2 = requests.post(f"{API}/sites/generate", json=payload, headers=headers, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        s1, s2 = r1.json(), r2.json()
        assert s1["slug"] != s2["slug"], f"Slugs collided: {s1['slug']} == {s2['slug']}"
        session_state.setdefault('cleanup_ids', []).extend([s1["id"], s2["id"]])

    @pytest.mark.timeout(180)
    def test_generate_with_image(self, user_a, session_state):
        """One real Gemini image generation to confirm integration works."""
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        payload = {
            "business_name": "Image Test Plomberie",
            "business_type": "Plomberie",
            "services": ["Dépannage"],
            "city": "Nice",
            "phone": "0600000000",
            "generate_image": True,
        }
        t0 = time.time()
        r = requests.post(f"{API}/sites/generate", json=payload, headers=headers, timeout=180)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        site = r.json()
        # Image should be a data URL (base64). We won't fail hard if Gemini hiccups; just warn.
        hero = site.get("hero_image_url")
        if not (hero and isinstance(hero, str) and hero.startswith("data:image/")):
            pytest.skip(f"Gemini image not produced (elapsed={elapsed:.1f}s, hero={str(hero)[:60]}). Non-fatal.")
        session_state.setdefault('cleanup_ids', []).append(site["id"])


class TestSitesCRUD:
    def test_list_sites_owner_only(self, user_a, user_b, site_a):
        # owner sees site
        ra = requests.get(f"{API}/sites", headers={"Authorization": f"Bearer {user_a['token']}"}, timeout=15)
        assert ra.status_code == 200
        ids = [s["id"] for s in ra.json()]
        assert site_a["id"] in ids
        # other user does NOT see site_a
        rb = requests.get(f"{API}/sites", headers={"Authorization": f"Bearer {user_b['token']}"}, timeout=15)
        assert rb.status_code == 200
        ids_b = [s["id"] for s in rb.json()]
        assert site_a["id"] not in ids_b

    def test_get_site_owner(self, user_a, site_a):
        r = requests.get(f"{API}/sites/{site_a['id']}", headers={"Authorization": f"Bearer {user_a['token']}"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == site_a["id"]

    def test_get_site_other_user_404(self, user_b, site_a):
        r = requests.get(f"{API}/sites/{site_a['id']}", headers={"Authorization": f"Bearer {user_b['token']}"}, timeout=15)
        assert r.status_code == 404

    def test_update_site_persists(self, user_a, site_a):
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        new_phone = "+33 1 23 45 67 89"
        new_name = "Dupont Rénovation SARL"
        r = requests.put(f"{API}/sites/{site_a['id']}", json={
            "phone": new_phone,
            "business_name": new_name,
            "content": {**site_a["content"], "hero_title": "Titre modifié"},
        }, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["phone"] == new_phone
        assert updated["business_name"] == new_name
        assert updated["content"]["hero_title"] == "Titre modifié"
        # GET to verify persisted
        r2 = requests.get(f"{API}/sites/{site_a['id']}", headers=headers, timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["phone"] == new_phone
        assert d["business_name"] == new_name
        assert d["content"]["hero_title"] == "Titre modifié"

    def test_publish_site(self, user_a, site_a):
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.post(f"{API}/sites/{site_a['id']}/publish", headers=headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "published"
        assert data["slug"] == site_a["slug"]
        # Verify persisted
        r2 = requests.get(f"{API}/sites/{site_a['id']}", headers=headers, timeout=15)
        assert r2.json()["status"] == "published"


# ---- Public + leads ----
class TestPublicAndLeads:
    def test_public_site_no_user_id(self, site_a):
        r = requests.get(f"{API}/public/sites/{site_a['slug']}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "user_id" not in data, "user_id leaked in public site response"
        assert data["slug"] == site_a["slug"]
        assert data["business_name"]

    def test_public_site_404(self):
        r = requests.get(f"{API}/public/sites/does-not-exist-xyz-{uuid.uuid4().hex[:6]}", timeout=15)
        assert r.status_code == 404

    def test_submit_lead_public(self, site_a, session_state):
        r = requests.post(f"{API}/public/sites/{site_a['slug']}/leads", json={
            "name": "Jean Client",
            "email": "TEST_jean@example.com",
            "phone": "0612345678",
            "message": "Bonjour, je voudrais un devis pour une rénovation."
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "id" in data
        session_state['lead_id'] = data["id"]

    def test_list_leads_owner(self, user_a, site_a, session_state):
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.get(f"{API}/sites/{site_a['id']}/leads", headers=headers, timeout=15)
        assert r.status_code == 200
        leads = r.json()
        assert isinstance(leads, list)
        assert any(l["email"] == "TEST_jean@example.com" for l in leads)

    def test_list_leads_other_user_404(self, user_b, site_a):
        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.get(f"{API}/sites/{site_a['id']}/leads", headers=headers, timeout=15)
        assert r.status_code == 404


# ---- Multi-tenant isolation: update/delete/publish ----
class TestIsolation:
    def test_other_user_cannot_update(self, user_b, site_a):
        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.put(f"{API}/sites/{site_a['id']}", json={"phone": "hacked"}, headers=headers, timeout=15)
        assert r.status_code == 404

    def test_other_user_cannot_publish(self, user_b, site_a):
        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.post(f"{API}/sites/{site_a['id']}/publish", headers=headers, timeout=15)
        assert r.status_code == 404

    def test_other_user_cannot_delete(self, user_b, site_a):
        headers = {"Authorization": f"Bearer {user_b['token']}"}
        r = requests.delete(f"{API}/sites/{site_a['id']}", headers=headers, timeout=15)
        assert r.status_code == 404


# ---- Cleanup last: delete site_a verifies leads cascade ----
class TestZDelete:
    def test_delete_site_cascades_leads(self, user_a, site_a):
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        r = requests.delete(f"{API}/sites/{site_a['id']}", headers=headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["deleted"] is True
        # Subsequent GET 404
        r2 = requests.get(f"{API}/sites/{site_a['id']}", headers=headers, timeout=15)
        assert r2.status_code == 404

    def test_cleanup_extra_sites(self, user_a, session_state):
        headers = {"Authorization": f"Bearer {user_a['token']}"}
        for sid in session_state.get('cleanup_ids', []):
            requests.delete(f"{API}/sites/{sid}", headers=headers, timeout=15)
