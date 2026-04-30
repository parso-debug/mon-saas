"""
ArtisanWeb SaaS - Website-as-a-Service backend
FastAPI + MongoDB + JWT auth + Claude Sonnet 4.5 (content) + Gemini Nano Banana (images)
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import base64
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt as pyjwt

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---- Config ----
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')
JWT_ALGO = os.environ.get('JWT_ALGO', 'HS256')
JWT_EXP_DAYS = 30

app = FastAPI(title="ArtisanWeb API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logger = logging.getLogger("artisanweb")
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


# ---------- Models ----------
class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: EmailStr
    full_name: str
    created_at: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class GenerateSiteIn(BaseModel):
    business_name: str
    business_type: str  # ex: "Plomberie", "Rénovation", "Électricité"
    services: List[str]
    city: str
    phone: str
    email: Optional[str] = None
    description: Optional[str] = None  # 1-2 phrases du métier
    style: str = "moderne"  # moderne, premium, minimaliste
    generate_image: bool = True


class SiteContent(BaseModel):
    """AI-generated content structure"""
    tagline: str
    hero_title: str
    hero_subtitle: str
    hero_cta: str
    value_props: List[Dict[str, str]]  # [{title, description, icon}]
    services: List[Dict[str, str]]  # [{name, description}]
    about_title: str
    about_text: str
    why_us: List[str]
    contact_intro: str
    seo_title: str
    seo_description: str
    seo_keywords: List[str]


class Site(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    slug: str
    business_name: str
    business_type: str
    services: List[str]
    city: str
    phone: str
    email: Optional[str] = None
    style: str
    content: Dict[str, Any]
    hero_image_url: Optional[str] = None
    logo_url: Optional[str] = None
    status: str = "draft"  # draft | published
    created_at: str
    updated_at: str


class SiteUpdate(BaseModel):
    business_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    services: Optional[List[str]] = None
    content: Optional[Dict[str, Any]] = None
    hero_image_url: Optional[str] = None
    logo_url: Optional[str] = None
    style: Optional[str] = None


class LeadIn(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    message: str


class Lead(BaseModel):
    id: str
    site_id: str
    name: str
    email: str
    phone: Optional[str] = None
    message: str
    created_at: str


# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pwd: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pwd.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


def slugify(text: str) -> str:
    s = text.lower()
    s = re.sub(r"[àáâãäå]", "a", s)
    s = re.sub(r"[èéêë]", "e", s)
    s = re.sub(r"[ìíîï]", "i", s)
    s = re.sub(r"[òóôõö]", "o", s)
    s = re.sub(r"[ùúûü]", "u", s)
    s = re.sub(r"[ç]", "c", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:60] or "site"


async def unique_slug(base: str) -> str:
    candidate = base
    i = 1
    while await db.sites.find_one({"slug": candidate}):
        i += 1
        candidate = f"{base}-{i}"
    return candidate


# ---------- AI Generation ----------
SYSTEM_PROMPT = """Tu es un expert en copywriting et SEO local pour des sites internet d'artisans et PME en France.
Tu écris en français professionnel, chaleureux, orienté conversion. Tu intègres naturellement la ville pour le SEO local.
Tu réponds STRICTEMENT en JSON valide, sans markdown, sans ```json, sans aucun texte avant ou après le JSON."""


def build_content_prompt(payload: GenerateSiteIn) -> str:
    services_str = ", ".join(payload.services)
    return f"""Génère le contenu complet d'un site internet pour cette entreprise artisanale française.

ENTREPRISE :
- Nom : {payload.business_name}
- Métier : {payload.business_type}
- Services : {services_str}
- Ville : {payload.city}
- Téléphone : {payload.phone}
- Description : {payload.description or 'Non fournie'}
- Style souhaité : {payload.style}

Réponds avec ce JSON EXACT (clés strictes, pas de texte autour) :
{{
  "tagline": "Une phrase de 5-8 mots qui résume l'entreprise",
  "hero_title": "Titre principal accrocheur 6-10 mots, avec le métier et la ville",
  "hero_subtitle": "Sous-titre de 15-25 mots qui décrit la promesse client et inclut '{payload.city}'",
  "hero_cta": "Texte du bouton principal (ex: Demander un devis gratuit)",
  "value_props": [
    {{"title": "Titre 2-4 mots", "description": "Description 12-18 mots", "icon": "shield-check"}},
    {{"title": "Titre 2-4 mots", "description": "Description 12-18 mots", "icon": "clock"}},
    {{"title": "Titre 2-4 mots", "description": "Description 12-18 mots", "icon": "award"}}
  ],
  "services": [
    {{"name": "Nom du service", "description": "Description claire 25-40 mots avec bénéfices client et SEO local pour {payload.city}"}}
  ],
  "about_title": "Titre de la section À propos 4-6 mots",
  "about_text": "Texte de présentation de 60-90 mots, à la première personne (nous), qui inspire confiance et mentionne {payload.city}",
  "why_us": ["Argument 1 court", "Argument 2 court", "Argument 3 court", "Argument 4 court"],
  "contact_intro": "Phrase d'intro de la section contact 15-25 mots",
  "seo_title": "Title HTML SEO 50-60 caractères incluant {payload.city} et le métier",
  "seo_description": "Meta description 140-160 caractères avec call-to-action et SEO local",
  "seo_keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"]
}}

IMPORTANT : autant de services dans le tableau "services" que dans la liste fournie ({len(payload.services)} services). Utilise des icônes lucide-react valides parmi : shield-check, clock, award, star, heart, hammer, wrench, home, phone, users, check-circle, zap, sparkles."""


async def generate_content_with_claude(payload: GenerateSiteIn) -> Dict[str, Any]:
    """Use Claude Sonnet 4.5 to generate French SEO-optimized content"""
    if not EMERGENT_LLM_KEY:
        return _fallback_content(payload)
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"gen-{uuid.uuid4()}",
            system_message=SYSTEM_PROMPT,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        msg = UserMessage(text=build_content_prompt(payload))
        text_response = await chat.send_message(msg)
        # Strip potential markdown fences
        text_response = text_response.strip()
        if text_response.startswith("```"):
            text_response = re.sub(r"^```[a-zA-Z]*\n", "", text_response)
            text_response = re.sub(r"\n```$", "", text_response)
        # Find first { ... last }
        start = text_response.find("{")
        end = text_response.rfind("}")
        if start != -1 and end != -1:
            text_response = text_response[start:end + 1]
        data = json.loads(text_response)
        return data
    except Exception as e:
        logger.error(f"Claude generation failed: {e}")
        return _fallback_content(payload)


def _fallback_content(payload: GenerateSiteIn) -> Dict[str, Any]:
    """Static fallback if AI fails"""
    services = [
        {"name": s, "description": f"Service {s} de qualité à {payload.city} et alentours. Devis gratuit, intervention rapide, finitions soignées."}
        for s in payload.services
    ]
    return {
        "tagline": f"{payload.business_type} de confiance à {payload.city}",
        "hero_title": f"{payload.business_type} à {payload.city} — Qualité & Savoir-faire",
        "hero_subtitle": f"{payload.business_name}, votre artisan {payload.business_type.lower()} à {payload.city}. Devis gratuit, intervention rapide, travail soigné.",
        "hero_cta": "Demander un devis gratuit",
        "value_props": [
            {"title": "Devis gratuit", "description": "Estimation transparente sous 24h, sans engagement.", "icon": "shield-check"},
            {"title": "Intervention rapide", "description": "Disponibles à {city} et environs, même en urgence.".replace("{city}", payload.city), "icon": "clock"},
            {"title": "Travail garanti", "description": "Finitions soignées et garantie décennale sur nos prestations.", "icon": "award"},
        ],
        "services": services,
        "about_title": f"Votre {payload.business_type.lower()} à {payload.city}",
        "about_text": f"Chez {payload.business_name}, nous mettons notre savoir-faire à votre service depuis plusieurs années. Implantés à {payload.city}, nous accompagnons particuliers et professionnels avec une exigence de qualité et un sens du détail. Notre engagement : un travail propre, des délais respectés, et une relation de confiance durable.",
        "why_us": ["Artisan local et reconnu", "Devis clair et détaillé", "Matériaux de qualité", "Garantie sur les travaux"],
        "contact_intro": f"Un projet ? Une urgence ? Contactez-nous, nous vous répondons rapidement à {payload.city}.",
        "seo_title": f"{payload.business_name} — {payload.business_type} à {payload.city}",
        "seo_description": f"{payload.business_type} à {payload.city}. Devis gratuit, intervention rapide. {payload.business_name} : artisan de confiance pour vos travaux.",
        "seo_keywords": [payload.business_type.lower(), payload.city.lower(), f"{payload.business_type.lower()} {payload.city.lower()}", "artisan", "devis gratuit"],
    }


async def generate_hero_image(payload: GenerateSiteIn) -> Optional[str]:
    """Use Gemini Nano Banana to generate a hero cover image. Returns data URL."""
    if not EMERGENT_LLM_KEY:
        return None
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"img-{uuid.uuid4()}",
            system_message="You are a professional commercial photographer.",
        ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        prompt = (
            f"Photographie professionnelle d'un artisan {payload.business_type.lower()} au travail. "
            f"Lumière naturelle douce, ambiance chaleureuse et authentique, cadrage cinématique horizontal 16:9. "
            f"Atelier ou chantier propre, outils visibles, mains au travail, atmosphère de savoir-faire. "
            f"Style éditorial, couleurs chaudes et naturelles, pas de texte ni logo dans l'image. "
            f"Photo réaliste haute qualité, profondeur de champ, magazine de design."
        )
        msg = UserMessage(text=prompt)
        text, images = await chat.send_message_multimodal_response(msg)
        if images and len(images) > 0:
            img = images[0]
            return f"data:{img['mime_type']};base64,{img['data']}"
        return None
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        return None


# ---------- Auth Routes ----------
@api_router.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    public = UserPublic(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"])
    return TokenOut(access_token=make_token(user["id"]), user=public)


@api_router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    public = UserPublic(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"])
    return TokenOut(access_token=make_token(user["id"]), user=public)


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(current_user)):
    return UserPublic(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"])


# ---------- Sites Routes ----------
@api_router.post("/sites/generate")
async def generate_site(body: GenerateSiteIn, user: dict = Depends(current_user)):
    """Generate a new site with AI (content + optional hero image)."""
    # Run content + image in parallel
    content_task = generate_content_with_claude(body)
    image_task = generate_hero_image(body) if body.generate_image else asyncio.sleep(0, result=None)
    content, image_data = await asyncio.gather(content_task, image_task)

    base_slug = slugify(body.business_name + "-" + body.city)
    slug = await unique_slug(base_slug)

    site_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "slug": slug,
        "business_name": body.business_name,
        "business_type": body.business_type,
        "services": body.services,
        "city": body.city,
        "phone": body.phone,
        "email": body.email,
        "style": body.style,
        "content": content,
        "hero_image_url": image_data,
        "logo_url": None,
        "status": "draft",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.sites.insert_one(site_doc)
    site_doc.pop("_id", None)
    return site_doc


@api_router.get("/sites")
async def list_sites(user: dict = Depends(current_user)):
    sites = await db.sites.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return sites


@api_router.get("/sites/{site_id}")
async def get_site(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]}, {"_id": 0})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    return site


@api_router.put("/sites/{site_id}")
async def update_site(site_id: str, body: SiteUpdate, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.sites.update_one({"id": site_id}, {"$set": update})
    updated = await db.sites.find_one({"id": site_id}, {"_id": 0})
    return updated


@api_router.post("/sites/{site_id}/publish")
async def publish_site(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    await db.sites.update_one({"id": site_id}, {"$set": {"status": "published", "updated_at": now_iso()}})
    return {"status": "published", "slug": site["slug"]}


@api_router.delete("/sites/{site_id}")
async def delete_site(site_id: str, user: dict = Depends(current_user)):
    res = await db.sites.delete_one({"id": site_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Site introuvable")
    await db.leads.delete_many({"site_id": site_id})
    return {"deleted": True}


# ---------- Public site (no auth) ----------
@api_router.get("/public/sites/{slug}")
async def public_site(slug: str):
    site = await db.sites.find_one({"slug": slug}, {"_id": 0})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    # Don't expose user_id
    site.pop("user_id", None)
    return site


@api_router.post("/public/sites/{slug}/leads")
async def submit_lead(slug: str, body: LeadIn):
    site = await db.sites.find_one({"slug": slug})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    lead = {
        "id": str(uuid.uuid4()),
        "site_id": site["id"],
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
        "message": body.message,
        "created_at": now_iso(),
    }
    await db.leads.insert_one(lead)
    lead.pop("_id", None)
    return {"ok": True, "id": lead["id"]}


# ---------- Leads (auth) ----------
@api_router.get("/sites/{site_id}/leads")
async def list_leads(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    leads = await db.leads.find({"site_id": site_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leads


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"service": "ArtisanWeb API", "ok": True}


# ---- Mount router & CORS ----
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
