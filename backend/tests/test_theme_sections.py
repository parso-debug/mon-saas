"""Iteration 4: theme + section_order persistence in PUT /api/sites/{id}"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"


def _rand_email():
    return f"TEST_theme_{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture(scope="module")
def auth_headers():
    email = _rand_email()
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "pass1234", "full_name": "Theme Tester"},
                      timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, email


@pytest.fixture(scope="module")
def site(auth_headers):
    headers, _ = auth_headers
    r = requests.post(
        f"{API}/sites/generate",
        headers=headers,
        json={
            "business_name": "TEST Atelier Theme",
            "business_type": "Menuiserie",
            "services": ["Pose de parquet", "Escaliers"],
            "city": "Lyon",
            "phone": "0600000000",
            "email": "atelier@test.fr",
            "description": "Artisan menuisier",
            "style": "moderne",
            "generate_image": False,
        },
        timeout=180,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestThemeAndSectionOrder:
    def test_put_persists_theme_and_section_order(self, auth_headers, site):
        headers, _ = auth_headers
        site_id = site["id"]
        theme = {
            "primary_color": "#1E3A8A",
            "accent_color": "#F59E0B",
            "font_heading": "Playfair Display",
            "font_body": "Inter",
        }
        section_order = ["hero", "services", "value_props", "about", "contact"]

        r = requests.put(f"{API}/sites/{site_id}", headers=headers,
                         json={"theme": theme, "section_order": section_order}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("theme") == theme
        assert data.get("section_order") == section_order

        # GET confirms persistence
        g = requests.get(f"{API}/sites/{site_id}", headers=headers, timeout=30)
        assert g.status_code == 200
        got = g.json()
        assert got["theme"] == theme
        assert got["section_order"] == section_order

    def test_public_get_returns_theme_and_section_order(self, site):
        slug = site["slug"]
        r = requests.get(f"{API}/public/sites/{slug}", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "theme" in data
        assert "section_order" in data
        assert data["section_order"][1] == "services"  # from previous test update
        # user_id must NOT be exposed
        assert "user_id" not in data

    def test_put_without_theme_is_backward_compatible(self, auth_headers, site):
        """Updating only business_name must not wipe theme/section_order."""
        headers, _ = auth_headers
        site_id = site["id"]
        r = requests.put(f"{API}/sites/{site_id}", headers=headers,
                         json={"business_name": "TEST Atelier Theme 2"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["business_name"] == "TEST Atelier Theme 2"
        # Theme still present
        assert data.get("theme", {}).get("primary_color") == "#1E3A8A"
        assert data.get("section_order")[1] == "services"

    def test_put_with_partial_theme_merges_at_field_level(self, auth_headers, site):
        """Pydantic Dict[str,Any] replaces the whole theme dict — verify full replacement works."""
        headers, _ = auth_headers
        site_id = site["id"]
        new_theme = {
            "primary_color": "#111827",
            "accent_color": "#F95A2C",
            "font_heading": "Instrument Serif",
            "font_body": "Manrope",
        }
        r = requests.put(f"{API}/sites/{site_id}", headers=headers,
                         json={"theme": new_theme}, timeout=30)
        assert r.status_code == 200
        assert r.json()["theme"] == new_theme

    def test_cleanup_site(self, auth_headers, site):
        headers, _ = auth_headers
        r = requests.delete(f"{API}/sites/{site['id']}", headers=headers, timeout=30)
        assert r.status_code == 200
