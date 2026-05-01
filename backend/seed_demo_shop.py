"""Seed a ready-to-use demo Pro account with a populated e-commerce shop.

Usage: python -m seed_demo_shop (from /app/backend)

Idempotent: re-running updates the existing demo user/shop/products without duplicating.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

DEMO_EMAIL = "demo.pro@artisanweb.fr"
DEMO_PASSWORD = "demo1234"
DEMO_NAME = "Démo Marchand"
SHOP_NAME = "La Boutique de Démo"
SHOP_SLUG = "la-boutique-de-demo"

PRODUCTS = [
    {
        "name": "T-shirt Bio Édition Limitée",
        "description": "T-shirt en coton biologique certifié GOTS, imprimé à la main à Lyon. Coupe unisexe.",
        "price_cents": 3490,
        "compare_at_cents": 3990,
        "stock": 42,
        "category": "Textile",
        "images": ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=900"],
        "variants": [
            {"name": "Taille", "options": ["S", "M", "L", "XL"]},
            {"name": "Couleur", "options": ["Noir", "Blanc", "Terracotta"]},
        ],
    },
    {
        "name": "Mug Céramique Artisanal",
        "description": "Mug tourné à la main, émail craquelé. Chaque pièce est unique. Contenance 35 cl.",
        "price_cents": 2200,
        "compare_at_cents": None,
        "stock": 18,
        "category": "Céramique",
        "images": ["https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900"],
        "variants": [{"name": "Couleur", "options": ["Sable", "Bleu orage", "Vert olive"]}],
    },
    {
        "name": "Bougie Parfumée 'Forêt'",
        "description": "Cire végétale de colza, parfum naturel notes de pin et cèdre. 45h de combustion.",
        "price_cents": 1800,
        "compare_at_cents": None,
        "stock": 7,
        "category": "Maison",
        "images": ["https://images.unsplash.com/photo-1602874801006-94d83a3c7aa2?w=900"],
        "variants": [],
    },
]


def slugify(text: str) -> str:
    import re
    s = text.lower()
    s = re.sub(r"[àáâãäå]", "a", s)
    s = re.sub(r"[èéêë]", "e", s)
    s = re.sub(r"[ìíîï]", "i", s)
    s = re.sub(r"[òóôõö]", "o", s)
    s = re.sub(r"[ùúûü]", "u", s)
    s = re.sub(r"[ç]", "c", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or str(uuid.uuid4())[:8]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def main() -> None:
    mongo_url = os.environ["MONGO_URL"]
    db = AsyncIOMotorClient(mongo_url)[os.environ["DB_NAME"]]

    # 1. User
    user = await db.users.find_one({"email": DEMO_EMAIL})
    pro_until = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
    if not user:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": DEMO_EMAIL,
            "full_name": DEMO_NAME,
            "password_hash": bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode(),
            "is_admin": False,
            "pro_until": pro_until,
            "created_at": now_iso(),
        })
        print(f"✓ Created demo user {DEMO_EMAIL} (Pro 1 year)")
    else:
        user_id = user["id"]
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"pro_until": pro_until, "password_hash": bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()}},
        )
        print(f"✓ Updated demo user {DEMO_EMAIL} (Pro refreshed)")

    # 2. Shop
    shop = await db.shops.find_one({"slug": SHOP_SLUG})
    if not shop:
        shop_id = str(uuid.uuid4())
        await db.shops.insert_one({
            "id": shop_id,
            "user_id": user_id,
            "name": SHOP_NAME,
            "slug": SHOP_SLUG,
            "description": "Boutique de démonstration — artisanat local, édition limitée. Livraison France.",
            "city": "Lyon",
            "address": "12 rue Lafayette, 69001 Lyon",
            "contact_email": DEMO_EMAIL,
            "phone": "04 72 00 00 00",
            "currency": "EUR",
            "tax_rate": 0.20,
            "tax_included": True,
            "shipping_rates": [
                {"id": "pickup", "name": "Retrait à Lyon", "amount_cents": 0, "is_pickup": True},
                {"id": "fr_metro", "name": "France métropolitaine", "amount_cents": 490, "is_pickup": False},
                {"id": "eu", "name": "Union européenne", "amount_cents": 990, "is_pickup": False},
            ],
            "theme": {
                "primary_color": "#1F3D2D",
                "accent_color": "#C84B31",
                "font_heading": "Instrument Serif",
                "font_body": "Manrope",
            },
            "logo_url": None,
            "hero_image_url": None,
            "status": "published",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        print(f"✓ Created demo shop '{SHOP_NAME}' (published)")
    else:
        shop_id = shop["id"]
        await db.shops.update_one({"id": shop_id}, {"$set": {"user_id": user_id, "status": "published"}})
        print(f"✓ Demo shop already exists (id={shop_id}), ensured published")

    # 3. Products (idempotent by slug within this shop)
    for p in PRODUCTS:
        slug = slugify(p["name"])
        existing = await db.products.find_one({"shop_id": shop_id, "slug": slug})
        doc = {
            "shop_id": shop_id,
            "name": p["name"],
            "slug": slug,
            "description": p["description"],
            "price_cents": p["price_cents"],
            "compare_at_cents": p.get("compare_at_cents"),
            "stock": p["stock"],
            "category": p["category"],
            "images": p["images"],
            "variants": p["variants"],
            "active": True,
            "updated_at": now_iso(),
        }
        if existing:
            await db.products.update_one({"id": existing["id"]}, {"$set": doc})
            print(f"  · Refreshed product {p['name']}")
        else:
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = now_iso()
            await db.products.insert_one(doc)
            print(f"  + Added product {p['name']}")

    # 4. One example order (only if no order exists yet for this shop)
    existing_orders = await db.orders.count_documents({"shop_id": shop_id})
    if existing_orders == 0:
        sample = await db.products.find_one({"shop_id": shop_id, "slug": slugify(PRODUCTS[0]["name"])})
        if sample:
            line_total = sample["price_cents"] * 2
            subtotal = line_total
            shipping = 490
            base = subtotal + shipping
            tax = int(round(base - base / 1.20))
            total = base
            await db.orders.insert_one({
                "id": str(uuid.uuid4()),
                "shop_id": shop_id,
                "shop_slug": SHOP_SLUG,
                "customer_name": "Camille Exemple",
                "customer_email": "camille@example.fr",
                "customer_phone": "+33 6 12 34 56 78",
                "shipping_method_id": "fr_metro",
                "shipping_method_name": "France métropolitaine",
                "shipping_is_pickup": False,
                "shipping_address": "42 avenue Victor Hugo, 75116 Paris",
                "items": [{
                    "product_id": sample["id"],
                    "name": sample["name"],
                    "slug": sample["slug"],
                    "image": (sample.get("images") or [None])[0],
                    "variant": {"Taille": "M", "Couleur": "Noir"},
                    "qty": 2,
                    "unit_price_cents": sample["price_cents"],
                    "line_total_cents": line_total,
                }],
                "subtotal_cents": subtotal,
                "shipping_cents": shipping,
                "tax_cents": tax,
                "total_cents": total,
                "currency": "EUR",
                "status": "paid",
                "stripe_session_id": f"demo_session_{uuid.uuid4().hex[:12]}",
                "payment_status": "paid",
                "applied": True,
                "applied_at": now_iso(),
                "created_at": now_iso(),
                "updated_at": now_iso(),
            })
            print("✓ Added example order (Camille Exemple, statut payé)")
    else:
        print(f"✓ {existing_orders} order(s) already present, skipping sample order")

    print("\n—— Demo ready ——")
    print(f"Login       : {DEMO_EMAIL} / {DEMO_PASSWORD}")
    print(f"Back-office : /dashboard → 'Gérer' sur la boutique")
    print(f"Vitrine     : /shop/{SHOP_SLUG}")


if __name__ == "__main__":
    asyncio.run(main())
