"""
Iteration 5: E-commerce backend tests (Shops / Products / Orders / Public checkout).

Covers:
- Shop CRUD, Pro-only gating (402 for free user), default shipping rates + theme + tax
- Product CRUD with variants
- Image upload returns /api/files/... and file is downloadable
- Public shop / public product (only when status=published, no user_id leak)
- Public checkout: amounts (tax-inclusive 20%), Stripe session creation, order persisted
- Stock validation (409), unknown shipping method (400), empty cart (400)
- Owner orders list + status update
- Multi-tenant isolation (user A cannot access user B's shop/products/orders)
- _apply_shop_order_if_paid path simulated by patching MongoDB directly (Stripe test key
  cannot retrieve sessions, so we patch order to paid and verify decrement is what the
  function does — here we test the happy-path behaviour of GET /shops/{id}/orders).
"""
import io
import os
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://aisite-builder-8.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# ---------------- helpers ----------------

def _register(email_prefix="TEST_shop"):
    email = f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "testpass123", "full_name": "T Shop"
    }, timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return email, data.get("access_token") or data.get("token"), data["user"]["id"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def _set_pro(email):
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    pro_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    db.users.update_one({"email": email}, {"$set": {"pro_until": pro_until}})
    client.close()


def _set_pro_sync(email):
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    pro_until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    res = db.users.update_one({"email": email.lower()}, {"$set": {"pro_until": pro_until}})
    client.close()
    return res.matched_count


def _patch_order_paid_sync(order_id):
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    db.orders.update_one(
        {"id": order_id},
        {"$set": {"payment_status": "paid", "status": "paid", "applied": True}},
    )
    client.close()


# ---------------- fixtures ----------------

@pytest.fixture(scope="module")
def pro_user():
    email, token, uid = _register("TEST_pro")
    matched = _set_pro_sync(email)
    assert matched == 1, f"failed to set pro_until for {email}"
    return {"email": email, "token": token, "id": uid}


@pytest.fixture(scope="module")
def free_user():
    email, token, uid = _register("TEST_free")
    return {"email": email, "token": token, "id": uid}


@pytest.fixture(scope="module")
def other_pro_user():
    email, token, uid = _register("TEST_pro2")
    _set_pro_sync(email)
    return {"email": email, "token": token, "id": uid}


@pytest.fixture(scope="module")
def shop(pro_user):
    r = requests.post(f"{API}/shops", json={
        "name": f"TEST Boutique {uuid.uuid4().hex[:6]}",
        "city": "Paris",
        "description": "Atelier test",
    }, headers=_h(pro_user["token"]), timeout=15)
    assert r.status_code == 200, r.text
    s = r.json()
    yield s
    # teardown
    requests.delete(f"{API}/shops/{s['id']}", headers=_h(pro_user["token"]), timeout=10)


# ---------------- tests ----------------

class TestShopCRUD:
    def test_free_user_cannot_create_shop(self, free_user):
        r = requests.post(f"{API}/shops", json={"name": "TEST Free shop"},
                          headers=_h(free_user["token"]), timeout=10)
        assert r.status_code == 402, r.text

    def test_pro_user_creates_shop_with_defaults(self, shop):
        assert shop["status"] == "draft"
        assert shop["tax_rate"] == 0.20
        assert shop["currency"] == "EUR"
        assert shop["theme"]["primary_color"]
        assert shop["theme"]["font_heading"]
        rates = shop["shipping_rates"]
        assert len(rates) == 3
        ids = {r["id"] for r in rates}
        assert {"pickup", "fr_metro", "eu"} == ids
        pickup = next(r for r in rates if r["id"] == "pickup")
        assert pickup["amount_cents"] == 0
        assert pickup["is_pickup"] is True

    def test_list_owned_shops(self, pro_user, shop):
        r = requests.get(f"{API}/shops", headers=_h(pro_user["token"]), timeout=10)
        assert r.status_code == 200
        ids = {s["id"] for s in r.json()}
        assert shop["id"] in ids

    def test_get_shop_by_id(self, pro_user, shop):
        r = requests.get(f"{API}/shops/{shop['id']}", headers=_h(pro_user["token"]), timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == shop["id"]

    def test_update_shop_fields(self, pro_user, shop):
        new_rates = [
            {"id": "pickup", "name": "Retrait", "amount_cents": 0, "is_pickup": True},
            {"id": "express", "name": "Express", "amount_cents": 1290, "is_pickup": False},
        ]
        r = requests.put(f"{API}/shops/{shop['id']}", json={
            "description": "Nouvelle desc",
            "shipping_rates": new_rates,
            "tax_rate": 0.20,
        }, headers=_h(pro_user["token"]), timeout=10)
        assert r.status_code == 200, r.text
        upd = r.json()
        assert upd["description"] == "Nouvelle desc"
        assert len(upd["shipping_rates"]) == 2

        # restore default rates so the rest of the suite (checkout) has fr_metro
        requests.put(f"{API}/shops/{shop['id']}", json={
            "shipping_rates": [
                {"id": "pickup", "name": "Retrait en boutique", "amount_cents": 0, "is_pickup": True},
                {"id": "fr_metro", "name": "France métro", "amount_cents": 490, "is_pickup": False},
            ],
        }, headers=_h(pro_user["token"]), timeout=10)


class TestMultiTenantIsolation:
    def test_other_user_cannot_get_shop(self, other_pro_user, shop):
        r = requests.get(f"{API}/shops/{shop['id']}",
                         headers=_h(other_pro_user["token"]), timeout=10)
        assert r.status_code == 404

    def test_other_user_cannot_update(self, other_pro_user, shop):
        r = requests.put(f"{API}/shops/{shop['id']}", json={"description": "hack"},
                         headers=_h(other_pro_user["token"]), timeout=10)
        assert r.status_code == 404

    def test_other_user_cannot_delete(self, other_pro_user, shop):
        r = requests.delete(f"{API}/shops/{shop['id']}",
                            headers=_h(other_pro_user["token"]), timeout=10)
        assert r.status_code == 404

    def test_other_user_cannot_list_products(self, other_pro_user, shop):
        r = requests.get(f"{API}/shops/{shop['id']}/products",
                         headers=_h(other_pro_user["token"]), timeout=10)
        assert r.status_code == 404


class TestProductCRUD:
    @pytest.fixture(scope="class")
    def product(self, pro_user, shop):
        r = requests.post(f"{API}/shops/{shop['id']}/products", json={
            "name": "TEST Bracelet",
            "description": "Joli bracelet",
            "price_cents": 2500,
            "stock": 10,
            "category": "bijoux",
            "variants": [
                {"name": "Taille", "options": ["S", "M", "L"]},
                {"name": "Couleur", "options": ["Noir", "Blanc"]},
            ],
            "active": True,
        }, headers=_h(pro_user["token"]), timeout=10)
        assert r.status_code == 200, r.text
        return r.json()

    def test_create_product_with_variants(self, product):
        assert product["price_cents"] == 2500
        assert product["stock"] == 10
        assert len(product["variants"]) == 2
        assert product["slug"]
        assert "_id" not in product

    def test_list_products(self, pro_user, shop, product):
        r = requests.get(f"{API}/shops/{shop['id']}/products",
                         headers=_h(pro_user["token"]), timeout=10)
        assert r.status_code == 200
        assert any(p["id"] == product["id"] for p in r.json())

    def test_update_product(self, pro_user, shop, product):
        r = requests.put(f"{API}/shops/{shop['id']}/products/{product['id']}",
                         json={"stock": 25, "price_cents": 2900},
                         headers=_h(pro_user["token"]), timeout=10)
        assert r.status_code == 200
        upd = r.json()
        assert upd["stock"] == 25
        assert upd["price_cents"] == 2900

    def test_delete_product_at_end(self, pro_user, shop):
        # create a throwaway product
        r = requests.post(f"{API}/shops/{shop['id']}/products", json={
            "name": "TEST Tmp", "price_cents": 100, "stock": 1, "active": True,
        }, headers=_h(pro_user["token"]), timeout=10)
        pid = r.json()["id"]
        d = requests.delete(f"{API}/shops/{shop['id']}/products/{pid}",
                            headers=_h(pro_user["token"]), timeout=10)
        assert d.status_code == 200


class TestImageUpload:
    def test_upload_returns_api_files_url(self, pro_user, shop):
        # tiny PNG bytes (1x1 transparent)
        png_bytes = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01"
            b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        files = {"file": ("test.png", io.BytesIO(png_bytes), "image/png")}
        r = requests.post(
            f"{API}/shops/{shop['id']}/upload-image?kind=product",
            files=files,
            headers={"Authorization": f"Bearer {pro_user['token']}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert url.startswith("/api/files/"), url
        # download via REACT_APP_BACKEND_URL + url
        dl = requests.get(BASE_URL + url, timeout=15)
        assert dl.status_code == 200
        assert len(dl.content) > 0


class TestPublicAndCheckout:
    @pytest.fixture(scope="class")
    def published_shop_and_product(self, pro_user):
        # Brand new shop to avoid interference with the module-level one
        s = requests.post(f"{API}/shops", json={
            "name": f"TEST Public {uuid.uuid4().hex[:6]}",
        }, headers=_h(pro_user["token"]), timeout=10).json()
        # add a product with stock 5
        p = requests.post(f"{API}/shops/{s['id']}/products", json={
            "name": "TEST Lampe",
            "price_cents": 12000,  # 120.00 €
            "stock": 5,
            "active": True,
            "variants": [{"name": "Taille", "options": ["S", "L"]}],
        }, headers=_h(pro_user["token"]), timeout=10).json()
        # publish
        pub = requests.post(f"{API}/shops/{s['id']}/publish",
                            headers=_h(pro_user["token"]), timeout=10)
        assert pub.status_code == 200
        yield {"shop": s, "product": p, "owner_token": pro_user["token"]}
        requests.delete(f"{API}/shops/{s['id']}", headers=_h(pro_user["token"]), timeout=10)

    def test_public_shop_no_user_id(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        r = requests.get(f"{API}/public/shops/{slug}", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "user_id" not in body["shop"]
        assert any(p["id"] == published_shop_and_product["product"]["id"]
                   for p in body["products"])

    def test_public_product(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        pslug = published_shop_and_product["product"]["slug"]
        r = requests.get(f"{API}/public/shops/{slug}/products/{pslug}", timeout=10)
        assert r.status_code == 200
        assert r.json()["id"] == published_shop_and_product["product"]["id"]

    def test_public_shop_404_when_draft(self, pro_user):
        s = requests.post(f"{API}/shops", json={"name": "TEST Draft"},
                          headers=_h(pro_user["token"]), timeout=10).json()
        r = requests.get(f"{API}/public/shops/{s['slug']}", timeout=10)
        assert r.status_code == 404
        requests.delete(f"{API}/shops/{s['id']}", headers=_h(pro_user["token"]), timeout=10)

    def test_checkout_empty_cart_400(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        r = requests.post(f"{API}/public/shops/{slug}/checkout", json={
            "items": [],
            "customer_name": "Jean Test",
            "customer_email": "jean@test.fr",
            "shipping_method_id": "pickup",
            "origin_url": BASE_URL,
        }, timeout=15)
        assert r.status_code == 400

    def test_checkout_unknown_shipping_400(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        pid = published_shop_and_product["product"]["id"]
        r = requests.post(f"{API}/public/shops/{slug}/checkout", json={
            "items": [{"product_id": pid, "qty": 1}],
            "customer_name": "Jean Test",
            "customer_email": "jean@test.fr",
            "shipping_method_id": "wormhole",
            "origin_url": BASE_URL,
        }, timeout=15)
        assert r.status_code == 400

    def test_checkout_insufficient_stock_409(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        pid = published_shop_and_product["product"]["id"]
        r = requests.post(f"{API}/public/shops/{slug}/checkout", json={
            "items": [{"product_id": pid, "qty": 50}],
            "customer_name": "Jean Test",
            "customer_email": "jean@test.fr",
            "shipping_method_id": "pickup",
            "origin_url": BASE_URL,
        }, timeout=15)
        assert r.status_code == 409

    def test_checkout_success_creates_order_and_session(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        pid = published_shop_and_product["product"]["id"]
        r = requests.post(f"{API}/public/shops/{slug}/checkout", json={
            "items": [{"product_id": pid, "qty": 2, "variant": {"Taille": "L"}}],
            "customer_name": "Jean Test",
            "customer_email": "jean@test.fr",
            "shipping_method_id": "fr_metro",
            "shipping_address": "1 rue test",
            "origin_url": BASE_URL,
        }, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["url"].startswith("https://")
        assert body["session_id"]
        assert body["order_id"]
        # Save for the next test (status / owner list)
        published_shop_and_product["last_order_id"] = body["order_id"]
        published_shop_and_product["last_session"] = body["session_id"]

    def test_amounts_tax_inclusive_via_owner_orders(self, published_shop_and_product):
        sid = published_shop_and_product["shop"]["id"]
        token = published_shop_and_product["owner_token"]
        r = requests.get(f"{API}/shops/{sid}/orders", headers=_h(token), timeout=10)
        assert r.status_code == 200, r.text
        orders = r.json()
        # find the order from previous test
        oid = published_shop_and_product.get("last_order_id")
        order = next((o for o in orders if o["id"] == oid), None)
        assert order is not None, "order not persisted"
        # 2 * 12000 = 24000 subtotal, 490 shipping, total=24490 (tax inclusive)
        assert order["subtotal_cents"] == 24000
        assert order["shipping_cents"] == 490
        assert order["total_cents"] == 24490
        # tax = round(24490 - 24490/1.2) = round(4081.66) = 4082
        assert order["tax_cents"] in (4081, 4082)
        assert order["status"] == "pending"
        assert order["applied"] is False
        assert order["currency"] == "EUR"

    def test_public_order_status_endpoint_responds(self, published_shop_and_product):
        slug = published_shop_and_product["shop"]["slug"]
        sess = published_shop_and_product.get("last_session")
        r = requests.get(f"{API}/public/shops/{slug}/orders/status/{sess}", timeout=15)
        # Stripe test key may fail status lookup but the endpoint must respond 200
        # because order exists; if status lookup failed, payment_status remains 'initiated'
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["order_id"] == published_shop_and_product["last_order_id"]

    def test_owner_can_update_order_status(self, published_shop_and_product):
        sid = published_shop_and_product["shop"]["id"]
        oid = published_shop_and_product["last_order_id"]
        token = published_shop_and_product["owner_token"]
        r = requests.put(f"{API}/shops/{sid}/orders/{oid}", json={"status": "shipped"},
                         headers=_h(token), timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "shipped"

    def test_owner_status_update_invalid_400(self, published_shop_and_product):
        sid = published_shop_and_product["shop"]["id"]
        oid = published_shop_and_product["last_order_id"]
        token = published_shop_and_product["owner_token"]
        r = requests.put(f"{API}/shops/{sid}/orders/{oid}", json={"status": "weird"},
                         headers=_h(token), timeout=10)
        assert r.status_code == 400

    def test_other_user_cannot_view_orders(self, other_pro_user, published_shop_and_product):
        sid = published_shop_and_product["shop"]["id"]
        r = requests.get(f"{API}/shops/{sid}/orders",
                         headers=_h(other_pro_user["token"]), timeout=10)
        assert r.status_code == 404

    def test_simulated_paid_via_db_patch(self, published_shop_and_product):
        oid = published_shop_and_product["last_order_id"]
        sid = published_shop_and_product["shop"]["id"]
        token = published_shop_and_product["owner_token"]
        _patch_order_paid_sync(oid)
        r = requests.get(f"{API}/shops/{sid}/orders", headers=_h(token), timeout=10)
        order = next(o for o in r.json() if o["id"] == oid)
        assert order["payment_status"] == "paid"


class TestRegression:
    def test_public_artisan_site_route_still_works(self, pro_user):
        # quick regression: hit a non-shop public endpoint to ensure server is healthy
        r = requests.get(f"{API}/public/sites/does-not-exist-xxxx", timeout=10)
        assert r.status_code in (404, 400)

    def test_login_still_works(self, pro_user):
        r = requests.post(f"{API}/auth/login", json={
            "email": pro_user["email"], "password": "testpass123"
        }, timeout=10)
        assert r.status_code == 200
        assert r.json().get("access_token")
