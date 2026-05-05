import json
"""
ArtisanWeb SaaS - Website-as-a-Service backend
FastAPI + MongoDB + JWT auth + Claude Sonnet 4.5 (content) + Gemini Nano Banana (images)
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
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
import resend
import requests as rq
import secrets as _secrets
import dns.resolver
import dns.exception

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
import stripe as stripe_sdk



from app_settings_defaults import DEFAULT_APP_SETTINGS

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
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
if STRIPE_API_KEY:
    stripe_sdk.api_key = STRIPE_API_KEY

# Admin bootstrap: comma-separated list of emails auto-promoted to admin
ADMIN_EMAILS = {
    e.strip().lower() for e in os.environ.get('ADMIN_EMAILS', '').split(',') if e.strip()
}

# ----- Object Storage -----
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
APP_NAME = "artisanweb"
_storage_key: Optional[str] = None


def _init_storage_sync() -> Optional[str]:
    """Initialize object storage. Returns reusable storage_key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        resp = rq.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json().get("storage_key")
        logger.info("Object storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Object storage init failed: {e}")
        return None


def _put_object_sync(path: str, data: bytes, content_type: str) -> Optional[str]:
    key = _init_storage_sync()
    if not key:
        return None
    try:
        resp = rq.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
        resp.raise_for_status()
        return resp.json().get("path", path)
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        return None


def _get_object_sync(path: str) -> Optional[tuple]:
    key = _init_storage_sync()
    if not key:
        return None
    try:
        resp = rq.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    except Exception as e:
        logger.error(f"Storage download failed: {e}")
        return None


async def upload_image_bytes(image_bytes: bytes, mime_type: str, kind: str, owner_id: str) -> Optional[str]:
    """Upload image to object storage and return a relative URL path served by /api/files/{path}."""
    ext = (mime_type.split("/")[-1] if "/" in mime_type else "png").split(";")[0]
    if ext == "jpeg":
        ext = "jpg"
    path = f"{APP_NAME}/{kind}/{owner_id}/{uuid.uuid4()}.{ext}"
    stored = await asyncio.to_thread(_put_object_sync, path, image_bytes, mime_type)
    if not stored:
        return None
    # Track in DB for soft-delete and content-type retrieval
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": stored,
        "kind": kind,
        "owner_id": owner_id,
        "content_type": mime_type,
        "size": len(image_bytes),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return f"/api/files/{stored}"

# ----- Pricing packages (server-side ONLY) -----
PACKAGES = {
    "pro_monthly": {"amount": 19.00, "currency": "eur", "label": "Pro · 30 jours", "days": 30},
    "pro_yearly":  {"amount": 190.00, "currency": "eur", "label": "Pro · 12 mois (-17%)", "days": 365},
}
FREE_SITE_LIMIT = 1

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
    is_admin: bool = False


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
    slug: Optional[str] = Field(default=None, min_length=3, max_length=60)
    show_map: Optional[bool] = None
    map_address: Optional[str] = None
    theme: Optional[Dict[str, Any]] = None  # {primary_color, accent_color, font_heading, font_body}
    section_order: Optional[List[str]] = None  # e.g. ["hero","value_props","services","about","contact"]


class DomainConnectIn(BaseModel):
    domain: str = Field(min_length=4, max_length=253)


class SlugCheckIn(BaseModel):
    slug: str = Field(min_length=3, max_length=60)


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


class CheckoutIn(BaseModel):
    package_id: str
    origin_url: str


class ReviewIn(BaseModel):
    author: str = Field(min_length=2, max_length=80)
    profession: str = Field(min_length=2, max_length=60)
    city: str = Field(min_length=2, max_length=60)
    email: EmailStr
    rating: int = Field(ge=1, le=5)
    quote: str = Field(min_length=20, max_length=600)
    avatar_url: Optional[str] = None


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
    user = await _ensure_admin_flag(user)
    return user


async def _ensure_admin_flag(user: dict) -> dict:
    """Idempotent: if user's email is in ADMIN_EMAILS, ensure is_admin=True in DB."""
    if not user:
        return user
    email = (user.get("email") or "").lower()
    should_be_admin = email in ADMIN_EMAILS
    is_admin_now = bool(user.get("is_admin"))
    if should_be_admin and not is_admin_now:
        await db.users.update_one({"id": user["id"]}, {"$set": {"is_admin": True}})
        user["is_admin"] = True
        logger.info(f"Promoted {email} to admin via ADMIN_EMAILS bootstrap")
    elif not is_admin_now:
        user["is_admin"] = False
    return user


async def admin_only(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accès admin requis")
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


SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$")
RESERVED_SLUGS = {
    "api", "admin", "dashboard", "billing", "login", "signup", "site",
    "onboarding", "generating", "builder", "auth", "public", "files",
    "webhook", "static", "assets", "support", "help", "pricing", "about",
    "contact", "legal", "terms", "privacy", "blog", "www", "app",
}


def validate_slug(slug: str) -> str:
    """Returns normalized slug or raises HTTPException 400."""
    s = (slug or "").strip().lower()
    if not SLUG_RE.match(s):
        raise HTTPException(
            status_code=400,
            detail="URL invalide : utilisez 3 à 60 caractères, lettres minuscules, chiffres et tirets uniquement (pas de tiret au début ou à la fin).",
        )
    if s in RESERVED_SLUGS:
        raise HTTPException(status_code=400, detail="Cette URL est réservée. Choisissez-en une autre.")
    return s


DOMAIN_RE = re.compile(r"^(?!-)(?:[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$")


def validate_domain(domain: str) -> str:
    d = (domain or "").strip().lower().rstrip(".")
    # Strip protocol if user pasted full URL
    d = re.sub(r"^https?://", "", d)
    d = d.split("/")[0]
    if not DOMAIN_RE.match(d):
        raise HTTPException(status_code=400, detail="Nom de domaine invalide. Exemple attendu : votre-entreprise.fr")
    if len(d) > 253:
        raise HTTPException(status_code=400, detail="Nom de domaine trop long.")
    return d


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


async def generate_hero_image(payload: GenerateSiteIn, owner_id: str = "anon") -> Optional[str]:
    """Use Gemini Nano Banana to generate a hero cover image. Returns URL (object storage) or data URL fallback."""
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
            try:
                image_bytes = base64.b64decode(img['data'])
                stored_url = await upload_image_bytes(image_bytes, img['mime_type'], "hero", owner_id)
                if stored_url:
                    return stored_url
            except Exception as e:
                logger.error(f"Hero image upload failed, fallback to base64: {e}")
            # Fallback to inline base64 if upload fails
            return f"data:{img['mime_type']};base64,{img['data']}"
        return None
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        return None


async def generate_logo_image(business_name: str, business_type: str, style: str = "moderne", owner_id: str = "anon") -> Optional[str]:
    """Use Gemini Nano Banana to generate a minimalist square logo."""
    if not EMERGENT_LLM_KEY:
        return None
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"logo-{uuid.uuid4()}",
            system_message="You are a professional logo designer.",
        ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

        style_hints = {
            "moderne": "minimaliste, géométrique, lignes nettes, monogramme typographique",
            "premium": "élégant, raffiné, couleurs sombres et or, sérigraphie haut de gamme",
            "minimaliste": "ultra simple, monochrome, beaucoup d'espace blanc, sans-serif fin",
        }.get(style, "minimaliste, géométrique, lignes nettes")

        first_letter = (business_name or "A").strip()[0].upper()
        prompt = (
            f"Logo carré professionnel pour une entreprise française d'artisan {business_type.lower()}. "
            f"Nom: {business_name}. Style: {style_hints}. "
            f"Format carré 1:1, fond uni neutre (beige clair ou blanc cassé), composition centrée. "
            f"Intégrer subtilement la lettre '{first_letter}' ou un symbole évoquant le métier. "
            f"Vectoriel-style, lignes propres, pas de photo, pas de dégradés complexes, parfait pour impression. "
            f"Aucun texte autre que '{business_name}' éventuellement, typographie sobre."
        )
        msg = UserMessage(text=prompt)
        text, images = await chat.send_message_multimodal_response(msg)
        if images and len(images) > 0:
            img = images[0]
            try:
                image_bytes = base64.b64decode(img['data'])
                stored_url = await upload_image_bytes(image_bytes, img['mime_type'], "logo", owner_id)
                if stored_url:
                    return stored_url
            except Exception as e:
                logger.error(f"Logo upload failed, fallback to base64: {e}")
            return f"data:{img['mime_type']};base64,{img['data']}"
        return None
    except Exception as e:
        logger.error(f"Logo generation failed: {e}")
        return None


def _send_email_sync(to_email: str, subject: str, html: str) -> Optional[str]:
    """Synchronous Resend send (called via asyncio.to_thread)."""
    if not RESEND_API_KEY:
        logger.info(f"[email skipped — no RESEND_API_KEY] would have sent to {to_email}: {subject}")
        return None
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html,
    }
    try:
        result = resend.Emails.send(params)
        return result.get("id") if isinstance(result, dict) else None
    except Exception as e:
        logger.error(f"Resend send failed: {e}")
        return None


async def send_lead_notification_email(owner_email: str, business_name: str, lead: dict, public_url: str) -> None:
    """Fire-and-forget email to artisan when a new lead is captured."""
    if not owner_email:
        return
    subject = f"Nouveau contact pour {business_name} 🔔"
    html = f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#FAFAFA; padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff; border:1px solid #E4E4E7;">
          <tr><td style="padding:32px 32px 0; border-bottom:4px solid #F95A2C;">
            <div style="font-family:monospace; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:#71717A; margin-bottom:8px;">// nouveau lead</div>
            <h1 style="margin:0 0 8px; font-size:28px; color:#09090B; font-weight:800;">Une demande pour <span style="color:#F95A2C;">{business_name}</span></h1>
            <p style="margin:0 0 24px; color:#52525B; font-size:14px;">Vous avez reçu un nouveau message via votre site internet.</p>
          </td></tr>
          <tr><td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E4E7;">
              <tr><td style="padding:14px 18px; border-bottom:1px solid #E4E4E7;"><div style="font-size:11px; color:#71717A; text-transform:uppercase; letter-spacing:.15em;">Nom</div><div style="font-size:16px; color:#09090B; font-weight:600;">{lead.get('name','')}</div></td></tr>
              <tr><td style="padding:14px 18px; border-bottom:1px solid #E4E4E7;"><div style="font-size:11px; color:#71717A; text-transform:uppercase; letter-spacing:.15em;">Email</div><a href="mailto:{lead.get('email','')}" style="font-size:16px; color:#F95A2C; text-decoration:none;">{lead.get('email','')}</a></td></tr>
              {f"<tr><td style='padding:14px 18px; border-bottom:1px solid #E4E4E7;'><div style='font-size:11px; color:#71717A; text-transform:uppercase; letter-spacing:.15em;'>Téléphone</div><a href='tel:{lead.get('phone','')}' style='font-size:16px; color:#F95A2C; text-decoration:none;'>{lead.get('phone','')}</a></td></tr>" if lead.get('phone') else ""}
              <tr><td style="padding:14px 18px;"><div style="font-size:11px; color:#71717A; text-transform:uppercase; letter-spacing:.15em; margin-bottom:8px;">Message</div><div style="font-size:15px; color:#1F2937; line-height:1.6; white-space:pre-wrap;">{lead.get('message','')}</div></td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:8px 32px 32px;">
            <a href="mailto:{lead.get('email','')}" style="display:inline-block; background:#09090B; color:#fff; padding:12px 24px; text-decoration:none; font-weight:600; font-size:14px;">Répondre maintenant</a>
            &nbsp;
            <a href="{public_url}" style="display:inline-block; background:#fff; color:#09090B; padding:11px 24px; text-decoration:none; font-weight:600; font-size:14px; border:1px solid #09090B;">Voir mon site</a>
          </td></tr>
          <tr><td style="padding:24px 32px; background:#FAFAFA; border-top:1px solid #E4E4E7;">
            <div style="font-family:monospace; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:#71717A;">artisanweb · made in france</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """
    try:
        email_id = await asyncio.to_thread(_send_email_sync, owner_email, subject, html)
        if email_id:
            logger.info(f"Lead notification sent to {owner_email} (id={email_id})")
    except Exception as e:
        logger.error(f"Lead notification failed: {e}")


# ---------- Auth Routes ----------
@api_router.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    is_admin_bootstrap = body.email.lower() in ADMIN_EMAILS
    user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower(),
        "password_hash": hash_password(body.password),
        "full_name": body.full_name,
        "is_admin": is_admin_bootstrap,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    public = UserPublic(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"], is_admin=user["is_admin"])
    return TokenOut(access_token=make_token(user["id"]), user=public)


@api_router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    user = await _ensure_admin_flag(user)
    public = UserPublic(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"], is_admin=bool(user.get("is_admin")))
    return TokenOut(access_token=make_token(user["id"]), user=public)


@api_router.get("/auth/me", response_model=UserPublic)
async def me(user: dict = Depends(current_user)):
    return UserPublic(id=user["id"], email=user["email"], full_name=user["full_name"], created_at=user["created_at"], is_admin=bool(user.get("is_admin")))


# ---------- Plan helpers ----------
async def is_pro(user: dict) -> bool:
    """Returns True if user has an active Pro subscription."""
    pro_until_str = user.get("pro_until")
    if not pro_until_str:
        return False
    try:
        pro_until = datetime.fromisoformat(pro_until_str)
        return pro_until > datetime.now(timezone.utc)
    except Exception:
        return False


# ---------- Sites Routes ----------
@api_router.post("/sites/generate")
async def generate_site(body: GenerateSiteIn, user: dict = Depends(current_user)):
    """Generate a new site with AI (content + optional hero image)."""
    # Free tier: limit number of sites
    if not await is_pro(user):
        existing_count = await db.sites.count_documents({"user_id": user["id"]})
        if existing_count >= FREE_SITE_LIMIT:
            raise HTTPException(
                status_code=402,
                detail=f"Limite atteinte ({FREE_SITE_LIMIT} site en gratuit). Passez à Pro pour des sites illimités.",
            )

    # Run content + image in parallel
    content_task = generate_content_with_claude(body)
    image_task = generate_hero_image(body, owner_id=user["id"]) if body.generate_image else asyncio.sleep(0, result=None)
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

    # Slug change: validate format + uniqueness (any user)
    if "slug" in update:
        new_slug = validate_slug(update["slug"])
        if new_slug != site.get("slug"):
            existing = await db.sites.find_one({"slug": new_slug, "id": {"$ne": site_id}}, {"_id": 0, "id": 1})
            if existing:
                raise HTTPException(status_code=409, detail="Cette URL est déjà utilisée. Choisissez-en une autre.")
        update["slug"] = new_slug

    update["updated_at"] = now_iso()
    await db.sites.update_one({"id": site_id}, {"$set": update})
    updated = await db.sites.find_one({"id": site_id}, {"_id": 0})
    return updated


@api_router.post("/sites/check-slug")
async def check_slug(body: SlugCheckIn, user: dict = Depends(current_user)):
    """Check slug availability before saving. Returns {available: bool, normalized: str}."""
    try:
        normalized = validate_slug(body.slug)
    except HTTPException as e:
        return {"available": False, "reason": e.detail, "normalized": None}
    existing = await db.sites.find_one({"slug": normalized}, {"_id": 0, "id": 1, "user_id": 1})
    # Allow if slug is already on a site owned by current user (idempotent check)
    if existing and existing.get("user_id") != user["id"]:
        return {"available": False, "reason": "URL déjà utilisée par un autre site", "normalized": normalized}
    return {"available": True, "normalized": normalized}


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


@api_router.post("/sites/{site_id}/regenerate-logo")
async def regenerate_logo(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    logo = await generate_logo_image(site["business_name"], site["business_type"], site.get("style", "moderne"), owner_id=user["id"])
    if not logo:
        raise HTTPException(status_code=502, detail="La génération de logo a échoué. Réessayez.")
    await db.sites.update_one({"id": site_id}, {"$set": {"logo_url": logo, "updated_at": now_iso()}})
    return {"logo_url": logo}


@api_router.post("/sites/{site_id}/regenerate-hero")
async def regenerate_hero(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    payload = GenerateSiteIn(
        business_name=site["business_name"],
        business_type=site["business_type"],
        services=site.get("services", []),
        city=site["city"],
        phone=site["phone"],
        style=site.get("style", "moderne"),
    )
    hero = await generate_hero_image(payload, owner_id=user["id"])
    if not hero:
        raise HTTPException(status_code=502, detail="La génération d'image a échoué. Réessayez.")
    await db.sites.update_one({"id": site_id}, {"$set": {"hero_image_url": hero, "updated_at": now_iso()}})
    return {"hero_image_url": hero}


# ---------- Custom Domain (Pro only) ----------
@api_router.post("/sites/{site_id}/domain/connect")
async def domain_connect(site_id: str, body: DomainConnectIn, user: dict = Depends(current_user)):
    """Reserve a custom domain for the site. Pro only. Returns DNS verification instructions."""
    if not await is_pro(user):
        raise HTTPException(status_code=402, detail="Le domaine personnalisé est réservé au plan Pro.")
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")

    domain = validate_domain(body.domain)

    # Domain unique across all sites
    existing = await db.sites.find_one({"custom_domain": domain, "id": {"$ne": site_id}}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(status_code=409, detail="Ce domaine est déjà connecté à un autre site.")

    token = _secrets.token_urlsafe(16)
    update = {
        "custom_domain": domain,
        "domain_token": token,
        "domain_verified": False,
        "domain_verified_at": None,
        "domain_connected_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.sites.update_one({"id": site_id}, {"$set": update})

    return {
        "domain": domain,
        "verified": False,
        "instructions": {
            "txt_record": {
                "type": "TXT",
                "name": f"_artisanweb-verify.{domain}",
                "value": token,
                "purpose": "Vérification de propriété (obligatoire)",
            },
            "a_record": {
                "type": "A",
                "name": "@",
                "value": "76.76.21.21",
                "purpose": "Pointer le domaine racine vers nos serveurs",
            },
            "cname_record": {
                "type": "CNAME",
                "name": "www",
                "value": "sites.artisanweb.app",
                "purpose": "Pointer le sous-domaine www",
            },
            "note": "Ajoutez ces 3 enregistrements chez votre registrar (OVH, Gandi, IONOS...). La propagation peut prendre jusqu'à 48h.",
        },
    }


def _lookup_txt_record(name: str) -> List[str]:
    """Synchronous DNS TXT lookup. Returns list of TXT strings or [] on error."""
    try:
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 8
        answers = resolver.resolve(name, "TXT")
        out = []
        for r in answers:
            try:
                strings = b"".join(r.strings).decode("utf-8", errors="ignore")
            except Exception:
                strings = str(r)
            out.append(strings.strip().strip('"'))
        return out
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.exception.DNSException):
        return []
    except Exception as e:
        logger.warning(f"DNS lookup error for {name}: {e}")
        return []


@api_router.post("/sites/{site_id}/domain/verify")
async def domain_verify(site_id: str, user: dict = Depends(current_user)):
    """Verify the custom domain by checking the TXT record. Returns verified=True if matches."""
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    domain = site.get("custom_domain")
    token = site.get("domain_token")
    if not domain or not token:
        raise HTTPException(status_code=400, detail="Aucun domaine connecté. Connectez d'abord un domaine.")

    txt_name = f"_artisanweb-verify.{domain}"
    records = await asyncio.to_thread(_lookup_txt_record, txt_name)
    matched = any(token in rec for rec in records)

    update = {"updated_at": now_iso()}
    if matched:
        update["domain_verified"] = True
        update["domain_verified_at"] = now_iso()
        await db.sites.update_one({"id": site_id}, {"$set": update})
        return {"verified": True, "domain": domain, "checked_records": records}
    return {
        "verified": False,
        "domain": domain,
        "expected_token": token,
        "checked_record_name": txt_name,
        "checked_records": records,
        "hint": "Le DNS n'est pas encore propagé ou le TXT record n'est pas correct. Réessayez dans quelques minutes." if not records else "Le record TXT existe mais ne contient pas le bon token. Vérifiez la valeur copiée.",
    }


@api_router.delete("/sites/{site_id}/domain")
async def domain_disconnect(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    await db.sites.update_one({"id": site_id}, {"$unset": {
        "custom_domain": "", "domain_token": "", "domain_verified": "",
        "domain_verified_at": "", "domain_connected_at": "",
    }, "$set": {"updated_at": now_iso()}})
    return {"disconnected": True}


# ---------- Public site (no auth) ----------
@api_router.get("/public/sites/by-domain/{domain}")
async def public_site_by_domain(domain: str):
    d = domain.strip().lower()
    site = await db.sites.find_one({"custom_domain": d, "domain_verified": True}, {"_id": 0})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    site.pop("user_id", None)
    site.pop("domain_token", None)
    return site


@api_router.get("/public/sites/{slug}")
async def public_site(slug: str):
    site = await db.sites.find_one({"slug": slug}, {"_id": 0})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    # Don't expose user_id or sensitive domain token
    site.pop("user_id", None)
    site.pop("domain_token", None)
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

    # Notify the site owner by email (artisan contact email if set, else owner account email)
    owner_email = site.get("email")
    if not owner_email:
        owner = await db.users.find_one({"id": site.get("user_id")}, {"_id": 0, "email": 1})
        owner_email = owner.get("email") if owner else None
    logger.info(f"Lead received for slug={slug}; owner_email={owner_email}")
    if owner_email:
        public_url = f"/site/{site['slug']}"
        asyncio.create_task(send_lead_notification_email(
            owner_email=owner_email,
            business_name=site.get("business_name", "votre site"),
            lead=lead,
            public_url=public_url,
        ))

    return {"ok": True, "id": lead["id"]}


# ---------- Leads (auth) ----------
@api_router.get("/sites/{site_id}/leads")
async def list_leads(site_id: str, user: dict = Depends(current_user)):
    site = await db.sites.find_one({"id": site_id, "user_id": user["id"]})
    if not site:
        raise HTTPException(status_code=404, detail="Site introuvable")
    leads = await db.leads.find({"site_id": site_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return leads


# ---------- Billing (Stripe) ----------
@api_router.get("/billing/me")
async def billing_me(user: dict = Depends(current_user)):
    pro = await is_pro(user)
    return {
        "plan": "pro" if pro else "free",
        "pro_until": user.get("pro_until"),
        "site_limit": None if pro else FREE_SITE_LIMIT,
        "packages": PACKAGES,
    }


@api_router.post("/billing/checkout")
async def billing_checkout(body: CheckoutIn, user: dict = Depends(current_user)):
    if body.package_id not in PACKAGES:
        raise HTTPException(status_code=400, detail="Package invalide")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")

    pkg = PACKAGES[body.package_id]
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/billing/cancel"
    webhook_url = f"{origin}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    metadata = {
        "user_id": user["id"],
        "user_email": user["email"],
        "package_id": body.package_id,
        "days": str(pkg["days"]),
    }
    req = CheckoutSessionRequest(
        amount=float(pkg["amount"]),
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    # MANDATORY: record transaction as initiated
    txn = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "package_id": body.package_id,
        "amount": float(pkg["amount"]),
        "currency": pkg["currency"],
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "open",
        "applied": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.payment_transactions.insert_one(txn)

    return {"url": session.url, "session_id": session.session_id}


async def _apply_pro_credit_if_paid(session_id: str) -> dict:
    """Re-poll Stripe and apply pro days only once per session."""
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction introuvable")

    if not STRIPE_API_KEY:
        return {"payment_status": txn.get("payment_status"), "status": txn.get("status"), "applied": txn.get("applied", False)}

    # Tolerate Stripe SDK errors (e.g. test-key sessions not retrievable, network issues)
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        status_resp = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.warning(f"Stripe status lookup failed for {session_id}: {e}")
        return {
            "payment_status": txn.get("payment_status", "pending"),
            "status": txn.get("status", "open"),
            "applied": txn.get("applied", False),
            "amount": txn.get("amount"),
            "currency": txn.get("currency"),
            "package_id": txn.get("package_id"),
            "lookup_error": True,
        }

    update = {
        "payment_status": status_resp.payment_status,
        "status": status_resp.status,
        "updated_at": now_iso(),
    }

    # Idempotent: only apply credit once
    if status_resp.payment_status == "paid" and not txn.get("applied", False):
        days = int(txn["metadata"].get("days", "30"))
        user = await db.users.find_one({"id": txn["user_id"]})
        if user:
            now = datetime.now(timezone.utc)
            current = user.get("pro_until")
            try:
                base = datetime.fromisoformat(current) if current else now
                if base < now:
                    base = now
            except Exception:
                base = now
            new_until = (base + timedelta(days=days)).isoformat()
            await db.users.update_one({"id": txn["user_id"]}, {"$set": {"pro_until": new_until}})
            update["applied"] = True
            update["applied_at"] = now_iso()

    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})
    fresh = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    return {
        "payment_status": fresh.get("payment_status"),
        "status": fresh.get("status"),
        "applied": fresh.get("applied", False),
        "amount": fresh.get("amount"),
        "currency": fresh.get("currency"),
        "package_id": fresh.get("package_id"),
    }


@api_router.get("/billing/status/{session_id}")
async def billing_status(session_id: str, user: dict = Depends(current_user)):
    txn = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    return await _apply_pro_credit_if_paid(session_id)


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        return {"ok": False}
    body_bytes = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        event = await stripe_checkout.handle_webhook(body_bytes, sig)
        if event.session_id:
            # Dispatch in order: domain purchase -> domain renewal -> shop order -> pro credit
            domain_purchase = await db.domains.find_one({"stripe_session_id": event.session_id}, {"_id": 0, "id": 1})
            if domain_purchase:
                await _apply_domain_purchase_if_paid(event.session_id)
            elif await _stripe_webhook_dispatch_renewal(event.session_id):
                pass
            else:
                shop_order = await db.orders.find_one({"stripe_session_id": event.session_id}, {"_id": 0, "id": 1})
                if shop_order:
                    await _apply_shop_order_if_paid(event.session_id)
                else:
                    await _apply_pro_credit_if_paid(event.session_id)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        return {"ok": False}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"service": "ArtisanWeb API", "ok": True}


# ---------- Public reviews (user-submitted) ----------
@api_router.post("/public/reviews")
async def submit_review(body: ReviewIn):
    """Public: anyone submits a review. Stored as pending until admin approves."""
    # Rate-limit: 1 review per email per 24h
    one_day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent = await db.reviews.find_one({"email": body.email.lower(), "submitted_at": {"$gt": one_day_ago}})
    if recent:
        raise HTTPException(status_code=429, detail="Vous avez déjà soumis un avis dans les 24 dernières heures. Merci !")

    review = {
        "id": str(uuid.uuid4()),
        "author": body.author.strip(),
        "profession": body.profession.strip(),
        "city": body.city.strip(),
        "email": body.email.lower(),
        "rating": body.rating,
        "quote": body.quote.strip(),
        "avatar_url": body.avatar_url,
        "status": "pending",
        "submitted_at": now_iso(),
        "moderated_at": None,
        "moderated_by": None,
    }
    await db.reviews.insert_one(review)
    return {"ok": True, "id": review["id"], "message": "Merci ! Votre avis sera publié après modération."}


def _public_review_view(r: dict) -> dict:
    return {
        "id": r["id"],
        "author": r["author"],
        "role": f"{r['profession']} · {r['city']}",
        "quote": r["quote"],
        "rating": r["rating"],
        "avatar_url": r.get("avatar_url"),
        "date": datetime.fromisoformat(r["submitted_at"]).strftime("%d/%m/%Y") if r.get("submitted_at") else None,
    }


@api_router.get("/public/reviews")
async def list_public_reviews():
    docs = await db.reviews.find({"status": "approved"}, {"_id": 0}).sort("submitted_at", -1).to_list(200)
    return [_public_review_view(d) for d in docs]


# ---------- Admin reviews moderation ----------
@api_router.get("/admin/reviews")
async def admin_list_reviews(_admin: dict = Depends(admin_only), status_filter: str = "pending"):
    q = {} if status_filter == "all" else {"status": status_filter}
    docs = await db.reviews.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(500)
    return docs


@api_router.post("/admin/reviews/{review_id}/approve")
async def admin_approve_review(review_id: str, admin: dict = Depends(admin_only)):
    res = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"status": "approved", "moderated_at": now_iso(), "moderated_by": admin["email"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Avis introuvable")
    return {"ok": True}


@api_router.post("/admin/reviews/{review_id}/reject")
async def admin_reject_review(review_id: str, admin: dict = Depends(admin_only)):
    res = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"status": "rejected", "moderated_at": now_iso(), "moderated_by": admin["email"]}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Avis introuvable")
    return {"ok": True}


@api_router.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, _admin: dict = Depends(admin_only)):
    res = await db.reviews.delete_one({"id": review_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Avis introuvable")
    return {"deleted": True}


@api_router.get("/admin/reviews/pending-count")
async def admin_pending_count(_admin: dict = Depends(admin_only)):
    count = await db.reviews.count_documents({"status": "pending"})
    return {"pending": count}


# ---------- Admin ----------
def _deep_merge(base: dict, override: dict) -> dict:
    """Deep-merge override into base. Lists are replaced (not merged)."""
    out = dict(base) if base else {}
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


@api_router.get("/app-settings")
async def get_app_settings():
    """Public endpoint: marketing landing content. Falls back to defaults."""
    doc = await db.app_settings.find_one({"id": "default"}, {"_id": 0, "id": 0})
    return _deep_merge(DEFAULT_APP_SETTINGS, doc or {})


@api_router.put("/admin/app-settings")
async def update_app_settings(body: Dict[str, Any], _admin: dict = Depends(admin_only)):
    """Admin only: replace the entire app_settings document with provided body. Idempotent upsert."""
    update = {**body, "id": "default", "updated_at": now_iso()}
    await db.app_settings.update_one({"id": "default"}, {"$set": update}, upsert=True)
    fresh = await db.app_settings.find_one({"id": "default"}, {"_id": 0, "id": 0})
    return _deep_merge(DEFAULT_APP_SETTINGS, fresh or {})


@api_router.post("/admin/app-settings/reset")
async def reset_app_settings(_admin: dict = Depends(admin_only)):
    await db.app_settings.delete_one({"id": "default"})
    return DEFAULT_APP_SETTINGS


@api_router.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), kind: str = Form("landing"), _admin: dict = Depends(admin_only)):
    """Admin upload: store an image in object storage, return a URL usable in app_settings."""
    contents = await file.read()
    if len(contents) > 5_000_000:
        raise HTTPException(status_code=413, detail="Fichier trop lourd (max 5 Mo)")
    mime = file.content_type or "image/png"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Seules les images sont acceptées")
    url = await upload_image_bytes(contents, mime, f"admin/{kind}", "platform")
    if not url:
        raise HTTPException(status_code=502, detail="Échec de l'upload")
    return {"url": url}


class AdminGrantProIn(BaseModel):
    email: EmailStr
    days: int = Field(default=30, ge=1, le=3650)


@api_router.post("/admin/users/grant-pro")
async def admin_grant_pro(body: AdminGrantProIn, _admin: dict = Depends(admin_only)):
    """Admin-only: grant Pro status to a user for N days (additive if already Pro).
    Useful for manual testing, demo accounts or customer support.
    """
    user = await db.users.find_one({"email": body.email.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    now = datetime.now(timezone.utc)
    current = user.get("pro_until")
    try:
        base = datetime.fromisoformat(current) if current else now
        if base < now:
            base = now
    except Exception:
        base = now
    new_until = (base + timedelta(days=body.days)).isoformat()
    await db.users.update_one({"id": user["id"]}, {"$set": {"pro_until": new_until}})
    return {"ok": True, "email": user["email"], "pro_until": new_until}



@api_router.get("/admin/stats")
async def admin_stats(_admin: dict = Depends(admin_only)):
    users_count = await db.users.count_documents({})
    sites_count = await db.sites.count_documents({})
    published_count = await db.sites.count_documents({"status": "published"})
    leads_count = await db.leads.count_documents({})
    pro_users = await db.users.count_documents({"pro_until": {"$gt": now_iso()}})
    paid_txns = await db.payment_transactions.count_documents({"payment_status": "paid"})
    revenue_pipeline = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": "$currency", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(20)
    return {
        "users": users_count,
        "sites": sites_count,
        "published_sites": published_count,
        "leads": leads_count,
        "pro_users": pro_users,
        "paid_transactions": paid_txns,
        "revenue_by_currency": revenue_pipeline,
    }


@api_router.get("/admin/users")
async def admin_users(_admin: dict = Depends(admin_only), limit: int = 100):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(min(limit, 500))
    # Count sites per user
    for u in users:
        u["sites_count"] = await db.sites.count_documents({"user_id": u["id"]})
    return users


# ---------- Public files (object storage proxy) ----------
from fastapi.responses import Response

@api_router.get("/files/{file_path:path}")
async def get_file(file_path: str):
    """Public proxy for object storage. Used for AI-generated images."""
    record = await db.files.find_one({"storage_path": file_path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    result = await asyncio.to_thread(_get_object_sync, file_path)
    if not result:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    data, content_type = result
    return Response(content=data, media_type=record.get("content_type") or content_type, headers={
        "Cache-Control": "public, max-age=31536000, immutable"
    })


@app.on_event("startup")
async def on_startup():
    try:
        await asyncio.to_thread(_init_storage_sync)
    except Exception as e:
        logger.error(f"Storage init at startup failed: {e}")


# =============================================================================
# E-COMMERCE (Shops / Products / Orders) — Phase 4
# =============================================================================

DEFAULT_SHIPPING_RATES = [
    {"id": "pickup", "name": "Retrait en boutique", "amount_cents": 0, "is_pickup": True},
    {"id": "fr_metro", "name": "France métropolitaine", "amount_cents": 490, "is_pickup": False},
    {"id": "eu", "name": "Union européenne", "amount_cents": 990, "is_pickup": False},
]
DEFAULT_SHOP_THEME = {
    "primary_color": "#1F3D2D",
    "accent_color": "#C84B31",
    "font_heading": "Instrument Serif",
    "font_body": "Manrope",
}
FREE_SHOP_LIMIT = 0  # boutique réservée au plan Pro (choix 5b)


class ShopCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    city: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None


class ShopUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    description: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    tax_rate: Optional[float] = Field(default=None, ge=0, le=1)
    currency: Optional[str] = None
    shipping_rates: Optional[List[Dict[str, Any]]] = None
    theme: Optional[Dict[str, Any]] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    slug: Optional[str] = Field(default=None, min_length=3, max_length=60)


class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = None
    price_cents: int = Field(ge=0)
    compare_at_cents: Optional[int] = Field(default=None, ge=0)
    stock: int = Field(ge=0, default=0)
    category: Optional[str] = None
    images: Optional[List[str]] = None
    variants: Optional[List[Dict[str, Any]]] = None  # [{name, options: [..]}]
    active: bool = True


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cents: Optional[int] = Field(default=None, ge=0)
    compare_at_cents: Optional[int] = Field(default=None, ge=0)
    stock: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = None
    images: Optional[List[str]] = None
    variants: Optional[List[Dict[str, Any]]] = None
    active: Optional[bool] = None


class CartItemIn(BaseModel):
    product_id: str
    qty: int = Field(ge=1, le=50)
    variant: Optional[Dict[str, str]] = None  # e.g. {"Taille":"M","Couleur":"Bleu"}


class CheckoutShopIn(BaseModel):
    items: List[CartItemIn]
    customer_name: str = Field(min_length=2, max_length=120)
    customer_email: EmailStr
    customer_phone: Optional[str] = None
    shipping_method_id: str
    shipping_address: Optional[str] = None
    origin_url: str


class OrderStatusUpdate(BaseModel):
    status: str  # pending/paid/shipped/delivered/cancelled


async def _unique_shop_slug(base: str) -> str:
    slug = slugify(base) or "boutique"
    candidate = slug
    i = 1
    while await db.shops.find_one({"slug": candidate}, {"_id": 0, "id": 1}):
        i += 1
        candidate = f"{slug}-{i}"
    return candidate


def _project_shop_public(shop: dict) -> dict:
    """Remove sensitive fields before exposing a shop publicly."""
    clean = {k: v for k, v in shop.items() if k not in {"_id", "user_id"}}
    return clean


def _project_product_public(p: dict) -> dict:
    clean = {k: v for k, v in p.items() if k != "_id"}
    return clean


# ---------- Shop CRUD ----------

@api_router.post("/shops")
async def create_shop(body: ShopCreate, user: dict = Depends(current_user)):
    """Create a shop. Pro-only feature."""
    if not await is_pro(user):
        raise HTTPException(
            status_code=402,
            detail="La boutique en ligne est réservée au plan Pro. Passez à Pro pour lancer votre e-commerce.",
        )
    base = body.name + (f"-{body.city}" if body.city else "")
    slug = await _unique_shop_slug(base)
    now = now_iso()
    shop = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": body.name,
        "slug": slug,
        "description": body.description or "",
        "city": body.city or "",
        "address": "",
        "contact_email": body.contact_email or user.get("email"),
        "phone": body.phone or "",
        "currency": "EUR",
        "tax_rate": 0.20,
        "tax_included": True,
        "shipping_rates": DEFAULT_SHIPPING_RATES,
        "theme": DEFAULT_SHOP_THEME,
        "logo_url": None,
        "hero_image_url": None,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    await db.shops.insert_one(shop)
    shop.pop("_id", None)
    return shop


@api_router.get("/shops")
async def list_shops(user: dict = Depends(current_user)):
    shops = await db.shops.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return shops


@api_router.get("/shops/{shop_id}")
async def get_shop(shop_id: str, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return shop


@api_router.put("/shops/{shop_id}")
async def update_shop(shop_id: str, body: ShopUpdate, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "slug" in update:
        new_slug = slugify(update["slug"]) or shop.get("slug")
        if new_slug != shop.get("slug"):
            existing = await db.shops.find_one({"slug": new_slug, "id": {"$ne": shop_id}}, {"_id": 0, "id": 1})
            if existing:
                raise HTTPException(status_code=409, detail="Cette URL de boutique est déjà utilisée.")
        update["slug"] = new_slug
    update["updated_at"] = now_iso()
    await db.shops.update_one({"id": shop_id}, {"$set": update})
    updated = await db.shops.find_one({"id": shop_id}, {"_id": 0})
    return updated


@api_router.post("/shops/{shop_id}/publish")
async def publish_shop(shop_id: str, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    await db.shops.update_one({"id": shop_id}, {"$set": {"status": "published", "updated_at": now_iso()}})
    return {"status": "published", "slug": shop["slug"]}


@api_router.delete("/shops/{shop_id}")
async def delete_shop(shop_id: str, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    await db.products.delete_many({"shop_id": shop_id})
    await db.orders.delete_many({"shop_id": shop_id})
    await db.shops.delete_one({"id": shop_id})
    return {"ok": True}


# ---------- Product CRUD ----------

@api_router.post("/shops/{shop_id}/products")
async def create_product(shop_id: str, body: ProductIn, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    now = now_iso()
    product = {
        "id": str(uuid.uuid4()),
        "shop_id": shop_id,
        "name": body.name,
        "slug": slugify(body.name) or str(uuid.uuid4())[:8],
        "description": body.description or "",
        "price_cents": body.price_cents,
        "compare_at_cents": body.compare_at_cents,
        "stock": body.stock,
        "category": body.category or "",
        "images": body.images or [],
        "variants": body.variants or [],
        "active": body.active,
        "created_at": now,
        "updated_at": now,
    }
    await db.products.insert_one(product)
    product.pop("_id", None)
    return product


@api_router.get("/shops/{shop_id}/products")
async def list_products(shop_id: str, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    products = await db.products.find({"shop_id": shop_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return products


@api_router.put("/shops/{shop_id}/products/{product_id}")
async def update_product(shop_id: str, product_id: str, body: ProductUpdate, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    res = await db.products.update_one({"id": product_id, "shop_id": shop_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated


@api_router.delete("/shops/{shop_id}/products/{product_id}")
async def delete_product(shop_id: str, product_id: str, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    res = await db.products.delete_one({"id": product_id, "shop_id": shop_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return {"ok": True}


@api_router.post("/shops/{shop_id}/upload-image")
async def upload_shop_image(shop_id: str, file: UploadFile = File(...), kind: str = Form("product"), user: dict = Depends(current_user)):
    """Upload an image (product / logo / hero) to object storage. Returns `/api/files/...` URL."""
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    if kind not in {"product", "logo", "hero"}:
        kind = "product"
    data = await file.read()
    if not data or len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier invalide (max 8 Mo)")
    mime = file.content_type or "image/png"
    url = await upload_image_bytes(data, mime, f"shop-{kind}", user["id"])
    if not url:
        raise HTTPException(status_code=500, detail="Échec de l'upload")
    return {"url": url}


# ---------- Public Shop / Products ----------

@api_router.get("/public/shops/{slug}")
async def public_shop(slug: str):
    shop = await db.shops.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    products = await db.products.find(
        {"shop_id": shop["id"], "active": True},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    return {"shop": _project_shop_public(shop), "products": [_project_product_public(p) for p in products]}


@api_router.get("/public/shops/{slug}/products/{product_slug}")
async def public_product(slug: str, product_slug: str):
    shop = await db.shops.find_one({"slug": slug, "status": "published"}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    product = await db.products.find_one({"shop_id": shop["id"], "slug": product_slug, "active": True}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    return _project_product_public(product)


# ---------- Checkout / Orders ----------

async def _compute_order_amounts(shop: dict, items_in: List[CartItemIn], shipping_method_id: str):
    """Return (line_items, subtotal_cents, shipping_cents, tax_cents, total_cents)."""
    shipping_rate = next((r for r in shop.get("shipping_rates", []) if r.get("id") == shipping_method_id), None)
    if not shipping_rate:
        raise HTTPException(status_code=400, detail="Méthode de livraison inconnue")

    lines = []
    subtotal = 0
    for it in items_in:
        product = await db.products.find_one({"id": it.product_id, "shop_id": shop["id"], "active": True}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Produit introuvable: {it.product_id}")
        if (product.get("stock", 0) or 0) < it.qty:
            raise HTTPException(status_code=409, detail=f"Stock insuffisant pour « {product['name']} »")
        unit = int(product.get("price_cents", 0))
        line_total = unit * it.qty
        subtotal += line_total
        lines.append({
            "product_id": product["id"],
            "name": product["name"],
            "slug": product.get("slug"),
            "image": (product.get("images") or [None])[0],
            "variant": it.variant or {},
            "qty": it.qty,
            "unit_price_cents": unit,
            "line_total_cents": line_total,
        })

    shipping_cents = int(shipping_rate.get("amount_cents", 0))
    tax_rate = float(shop.get("tax_rate", 0.20) or 0)
    tax_included = bool(shop.get("tax_included", True))
    if tax_included:
        # Prices already include VAT; compute informative tax
        base = subtotal + shipping_cents
        tax_cents = int(round(base - (base / (1 + tax_rate)))) if tax_rate else 0
        total = base
    else:
        base = subtotal + shipping_cents
        tax_cents = int(round(base * tax_rate))
        total = base + tax_cents
    return lines, subtotal, shipping_cents, tax_cents, total, shipping_rate


@api_router.post("/public/shops/{slug}/checkout")
async def shop_checkout(slug: str, body: CheckoutShopIn):
    shop = await db.shops.find_one({"slug": slug, "status": "published"}, {"_id": 0})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    if not body.items:
        raise HTTPException(status_code=400, detail="Panier vide")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Paiement non configuré")

    lines, subtotal, shipping_cents, tax_cents, total_cents, shipping_rate = await _compute_order_amounts(
        shop, body.items, body.shipping_method_id,
    )

    now = now_iso()
    order_id = str(uuid.uuid4())
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/shop/{slug}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/shop/{slug}/checkout?cancelled=1"
    webhook_url = f"{origin}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    metadata = {
        "kind": "shop_order",
        "order_id": order_id,
        "shop_id": shop["id"],
        "shop_slug": slug,
    }
    req = CheckoutSessionRequest(
        amount=float(total_cents) / 100.0,
        currency=(shop.get("currency") or "eur").lower(),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    order = {
        "id": order_id,
        "shop_id": shop["id"],
        "shop_slug": slug,
        "customer_name": body.customer_name,
        "customer_email": body.customer_email,
        "customer_phone": body.customer_phone,
        "shipping_method_id": body.shipping_method_id,
        "shipping_method_name": shipping_rate.get("name"),
        "shipping_is_pickup": bool(shipping_rate.get("is_pickup")),
        "shipping_address": body.shipping_address or "",
        "items": lines,
        "subtotal_cents": subtotal,
        "shipping_cents": shipping_cents,
        "tax_cents": tax_cents,
        "total_cents": total_cents,
        "currency": (shop.get("currency") or "EUR").upper(),
        "status": "pending",
        "stripe_session_id": session.session_id,
        "payment_status": "initiated",
        "applied": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order)
    return {"url": session.url, "session_id": session.session_id, "order_id": order_id}


async def _apply_shop_order_if_paid(session_id: str) -> Optional[dict]:
    order = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not order:
        return None
    if not STRIPE_API_KEY:
        return order

    try:
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        status_resp = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.warning(f"Stripe status lookup failed for shop order {session_id}: {e}")
        return order

    update = {
        "payment_status": status_resp.payment_status,
        "updated_at": now_iso(),
    }
    if status_resp.payment_status == "paid" and not order.get("applied", False):
        update["applied"] = True
        update["applied_at"] = now_iso()
        update["status"] = "paid"
        # Decrement stock atomically
        for line in order.get("items", []):
            await db.products.update_one(
                {"id": line["product_id"], "stock": {"$gte": line["qty"]}},
                {"$inc": {"stock": -line["qty"]}},
            )
        # Notify shop owner + customer by email (if Resend configured)
        try:
            shop = await db.shops.find_one({"id": order["shop_id"]}, {"_id": 0})
            if shop and RESEND_API_KEY:
                owner_email = shop.get("contact_email")
                if owner_email:
                    items_html = "".join(
                        f"<li>{ln['qty']}× {ln['name']} — {ln['line_total_cents']/100:.2f} €</li>"
                        for ln in order.get("items", [])
                    )
                    resend.Emails.send({
                        "from": SENDER_EMAIL,
                        "to": owner_email,
                        "subject": f"Nouvelle commande #{order['id'][:8]} — {shop['name']}",
                        "html": f"<h2>Commande payée</h2><p>Client : {order['customer_name']} ({order['customer_email']})</p><ul>{items_html}</ul><p><b>Total : {order['total_cents']/100:.2f} €</b></p><p>Livraison : {order.get('shipping_method_name')}</p>",
                    })
                resend.Emails.send({
                    "from": SENDER_EMAIL,
                    "to": order["customer_email"],
                    "subject": f"Merci pour votre commande — {shop['name']}",
                    "html": f"<h2>Confirmation de commande</h2><p>Bonjour {order['customer_name']},</p><p>Votre commande <b>#{order['id'][:8]}</b> a bien été reçue. Montant : <b>{order['total_cents']/100:.2f} €</b>.</p>",
                })
        except Exception as e:
            logger.error(f"Order email failed: {e}")

    await db.orders.update_one({"stripe_session_id": session_id}, {"$set": update})
    return await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})


@api_router.get("/public/shops/{slug}/orders/status/{session_id}")
async def public_order_status(slug: str, session_id: str):
    """Public endpoint so the /shop/.../success page can poll payment status."""
    order = await _apply_shop_order_if_paid(session_id)
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return {
        "order_id": order.get("id"),
        "status": order.get("status"),
        "payment_status": order.get("payment_status"),
        "total_cents": order.get("total_cents"),
        "currency": order.get("currency"),
        "customer_email": order.get("customer_email"),
        "items": order.get("items", []),
        "shipping_method_name": order.get("shipping_method_name"),
    }


@api_router.get("/shops/{shop_id}/orders")
async def list_orders(shop_id: str, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    orders = await db.orders.find({"shop_id": shop_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api_router.put("/shops/{shop_id}/orders/{order_id}")
async def update_order_status(shop_id: str, order_id: str, body: OrderStatusUpdate, user: dict = Depends(current_user)):
    shop = await db.shops.find_one({"id": shop_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not shop:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    allowed = {"pending", "paid", "shipped", "delivered", "cancelled"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail="Statut invalide")
    res = await db.orders.update_one(
        {"id": order_id, "shop_id": shop_id},
        {"$set": {"status": body.status, "updated_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated


# =============================================================================
# DOMAIN MARKETPLACE — Phase 5 (MVP with mocked registrar, real Stripe+DB+DNS)
# =============================================================================

# Target A record the platform DNS config points to.
# In production this would be a stable public IP or load balancer hostname.
PLATFORM_A_RECORD = os.environ.get("PLATFORM_A_RECORD_IP", "76.76.21.21")  # Vercel-style anycast IP placeholder

# TLD pricing. `cost_cents` = our cost at registrar, `margin_cents` = fixed 10€ margin.
TLD_PRICING = {
    "fr":       {"cost_cents":  900, "margin_cents": 1000, "available": True},
    "com":      {"cost_cents": 1400, "margin_cents": 1000, "available": True},
    "shop":     {"cost_cents": 3500, "margin_cents": 1000, "available": True},
    "boutique": {"cost_cents": 3000, "margin_cents": 1000, "available": True},
    "eu":       {"cost_cents":  800, "margin_cents": 1000, "available": True},
    "net":      {"cost_cents": 1300, "margin_cents": 1000, "available": True},
    "bzh":      {"cost_cents": 2500, "margin_cents": 1000, "available": True},
    "paris":    {"cost_cents": 3000, "margin_cents": 1000, "available": True},
}
DOMAIN_DEFAULT_PRICING = {"cost_cents": 1200, "margin_cents": 1000}


def _split_domain(fqdn: str) -> tuple:
    fqdn = (fqdn or "").strip().lower().lstrip(".")
    if "." not in fqdn:
        raise HTTPException(status_code=400, detail="Nom de domaine invalide")
    parts = fqdn.split(".")
    if len(parts) > 4 or any(not re.match(r"^[a-z0-9-]{1,63}$", p) or p.startswith("-") or p.endswith("-") for p in parts):
        raise HTTPException(status_code=400, detail="Nom de domaine invalide")
    name = parts[0]
    tld = ".".join(parts[1:])
    return name, tld, fqdn


def _tld_price(tld: str) -> dict:
    tld = tld.lstrip(".")
    p = TLD_PRICING.get(tld, {**DOMAIN_DEFAULT_PRICING, "available": True})
    total = p["cost_cents"] + p["margin_cents"]
    return {
        "tld": tld,
        "cost_cents": p["cost_cents"],
        "margin_cents": p["margin_cents"],
        "total_cents": total,
        "available": p.get("available", True),
    }


def _is_available_mock(fqdn: str) -> bool:
    """Deterministic mock: hash the FQDN, ~75% of names available, reserved blacklist for a few famous ones."""
    import hashlib
    low = fqdn.lower()
    taken_list = {"google.com", "facebook.com", "apple.com", "amazon.com", "artisanweb.fr", "test.fr", "example.com", "leboncoin.fr"}
    if low in taken_list:
        return False
    digest = int(hashlib.sha256(low.encode()).hexdigest(), 16)
    return (digest % 4) != 0


def _suggest_domains(business_type: Optional[str], city: Optional[str], base: Optional[str] = None) -> List[str]:
    """Generate domain name suggestions based on trade + city."""
    t = slugify(business_type or "artisan")[:20]
    c = slugify(city or "")[:20]
    b = slugify(base or "")[:20]
    candidates: List[str] = []
    if t and c:
        candidates += [f"{t}-{c}", f"le-{t}-{c}", f"{t}{c}", f"mon-{t}-{c}"]
    if t:
        candidates += [f"{t}-pro", f"artisan-{t}"]
    if b:
        candidates += [f"{b}", f"{b}-{c}" if c else b, f"{b}-pro"]
    # Deduplicate while preserving order
    seen = set()
    unique = []
    for c_ in candidates:
        if c_ and c_ not in seen and 3 <= len(c_) <= 40:
            seen.add(c_)
            unique.append(c_)

    out: List[str] = []
    for base_name in unique[:8]:
        for tld in ("fr", "com", "shop"):
            out.append(f"{base_name}.{tld}")
    return out[:12]


def _project_domain_public(d: dict) -> dict:
    return {k: v for k, v in d.items() if k not in {"_id", "internal_notes"}}


class DomainSearchSuggestion(BaseModel):
    domain: str
    available: bool
    total_cents: int
    currency: str = "EUR"


class DomainPurchaseIn(BaseModel):
    domain: str = Field(min_length=4, max_length=253)
    project_id: Optional[str] = None  # site_id OR shop_id (we store whichever fits)
    project_kind: str = Field(default="site")  # "site" | "shop"
    origin_url: str


# ---------- Search ----------

@api_router.get("/domains/search")
async def domain_search(name: str, business_type: Optional[str] = None, city: Optional[str] = None, _user: dict = Depends(current_user)):
    """Search a domain + return suggestions with availability and pricing.

    Returns:
        - query: the input name normalized
        - result: { domain, available, total_cents } for the exact query (if TLD included)
        - suggestions: list of alternative domains with availability + pricing
    """
    name = (name or "").strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Nom requis")

    # If the user typed a FQDN (with a dot), check it directly
    exact_result: Optional[dict] = None
    if "." in name:
        base, tld, fqdn = _split_domain(name)
        pricing = _tld_price(tld)
        exact_result = {
            "domain": fqdn,
            "available": pricing["available"] and _is_available_mock(fqdn),
            **{k: pricing[k] for k in ("tld", "cost_cents", "margin_cents", "total_cents")},
        }
        base_for_suggestions = base
    else:
        base_for_suggestions = name

    # Build suggestions
    raw_suggestions = _suggest_domains(business_type, city, base=base_for_suggestions)
    # Ensure the base itself is tried across all TLDs
    if base_for_suggestions:
        for tld in ("fr", "com", "shop", "boutique"):
            fqdn = f"{slugify(base_for_suggestions)}.{tld}"
            if fqdn not in raw_suggestions:
                raw_suggestions.insert(0, fqdn)
    raw_suggestions = raw_suggestions[:12]

    suggestions: List[dict] = []
    for fqdn in raw_suggestions:
        try:
            _, tld, norm = _split_domain(fqdn)
        except HTTPException:
            continue
        pricing = _tld_price(tld)
        suggestions.append({
            "domain": norm,
            "available": pricing["available"] and _is_available_mock(norm),
            "tld": pricing["tld"],
            "cost_cents": pricing["cost_cents"],
            "margin_cents": pricing["margin_cents"],
            "total_cents": pricing["total_cents"],
        })

    return {"query": name, "result": exact_result, "suggestions": suggestions, "currency": "EUR"}


# ---------- Purchase (Stripe checkout) ----------

@api_router.post("/domains/purchase")
async def domain_purchase(body: DomainPurchaseIn, user: dict = Depends(current_user)):
    """Create a Stripe Checkout session to purchase a domain.
    On webhook/paid, we trigger the mocked registrar order + DNS configuration.
    """
    _, tld, fqdn = _split_domain(body.domain)
    pricing = _tld_price(tld)
    if not pricing["available"]:
        raise HTTPException(status_code=400, detail=f"TLD .{tld} non supporté")
    if not _is_available_mock(fqdn):
        raise HTTPException(status_code=409, detail="Ce domaine n'est plus disponible")

    # Prevent double-buying in our DB
    existing = await db.domains.find_one({"domain_name": fqdn, "status": {"$in": ["active", "pending", "paid"]}})
    if existing:
        raise HTTPException(status_code=409, detail="Ce domaine a déjà été acheté sur la plateforme")

    # Verify project ownership if project_id provided
    project_kind = body.project_kind if body.project_kind in ("site", "shop") else "site"
    if body.project_id:
        coll = "sites" if project_kind == "site" else "shops"
        project = await db[coll].find_one({"id": body.project_id, "user_id": user["id"]}, {"_id": 0, "id": 1, "slug": 1})
        if not project:
            raise HTTPException(status_code=404, detail="Projet introuvable")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Paiement non configuré")

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/domain/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/domain/cancel"
    webhook_url = f"{origin}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    metadata = {
        "kind": "domain_purchase",
        "domain": fqdn,
        "user_id": user["id"],
        "project_id": body.project_id or "",
        "project_kind": project_kind,
    }
    req = CheckoutSessionRequest(
        amount=float(pricing["total_cents"]) / 100.0,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    now = now_iso()
    now_dt = datetime.now(timezone.utc)
    domain_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "project_id": body.project_id,
        "project_kind": project_kind,
        "domain_name": fqdn,
        "tld": tld,
        "status": "pending",  # pending -> paid -> active | error
        "provider": "mock-registrar",  # swap to 'namecheap' / 'gandi' when integrated
        "cost_cents": pricing["cost_cents"],
        "margin_cents": pricing["margin_cents"],
        "amount_cents": pricing["total_cents"],
        "currency": "EUR",
        "purchase_date": None,
        "expiry_date": (now_dt + timedelta(days=365)).isoformat(),
        "dns_config": None,
        "ssl_status": "pending",
        "stripe_session_id": session.session_id,
        "payment_status": "initiated",
        "created_at": now,
        "updated_at": now,
    }
    await db.domains.insert_one(domain_doc)

    return {
        "url": session.url,
        "session_id": session.session_id,
        "domain": fqdn,
        "amount_cents": pricing["total_cents"],
        "currency": "EUR",
    }


def _build_dns_config(fqdn: str) -> dict:
    """Return the DNS records a user would normally have to set — all handled automatically here."""
    return {
        "provider": "platform-dns (auto)",
        "records": [
            {"type": "A", "host": "@", "value": PLATFORM_A_RECORD, "ttl": 3600, "description": "Domaine racine"},
            {"type": "A", "host": "www", "value": PLATFORM_A_RECORD, "ttl": 3600, "description": "Sous-domaine www"},
            {"type": "CAA", "host": "@", "value": "0 issue \"letsencrypt.org\"", "ttl": 3600, "description": "Autorisation SSL (Let's Encrypt)"},
        ],
        "a_record_target": PLATFORM_A_RECORD,
        "configured_at": now_iso(),
    }


async def _mock_registrar_purchase(fqdn: str, user_email: str) -> dict:
    """Mocked registrar order. Replace with real Namecheap/Gandi/OpenProvider API call here.

    Must return: { registrar_order_id, registration_date, expiry_date }
    """
    await asyncio.sleep(0.05)  # simulate API latency
    now = datetime.now(timezone.utc)
    return {
        "registrar_order_id": f"MOCK-{uuid.uuid4().hex[:10].upper()}",
        "registration_date": now.isoformat(),
        "expiry_date": (now + timedelta(days=365)).isoformat(),
    }


async def _auto_connect_domain_to_project(domain_doc: dict) -> Optional[dict]:
    """Apply the purchased domain to its linked project (site or shop) so the site is served at that URL."""
    project_id = domain_doc.get("project_id")
    if not project_id:
        return None
    kind = domain_doc.get("project_kind", "site")
    if kind == "site":
        coll = db.sites
    elif kind == "shop":
        coll = db.shops
    else:
        return None
    # Verify the project still belongs to the buyer
    project = await coll.find_one({"id": project_id, "user_id": domain_doc["user_id"]}, {"_id": 0, "id": 1})
    if not project:
        return None
    await coll.update_one(
        {"id": project_id},
        {"$set": {
            "custom_domain": domain_doc["domain_name"],
            "domain_verified": True,
            "domain_verified_at": now_iso(),
            "domain_token": None,
            "updated_at": now_iso(),
        }},
    )
    return {"kind": kind, "id": project_id}


async def _apply_domain_purchase_if_paid(session_id: str) -> Optional[dict]:
    """Idempotent: run registrar purchase + DNS config + attach to project when Stripe session is paid."""
    doc = await db.domains.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not doc:
        return None
    if doc.get("status") == "active":
        return doc

    # Resolve payment status: prefer stored (webhook set it) else query Stripe.
    resolved_payment_status: Optional[str] = doc.get("payment_status")
    if resolved_payment_status != "paid" and STRIPE_API_KEY:
        try:
            stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
            status_resp = await stripe_checkout.get_checkout_status(session_id)
            resolved_payment_status = status_resp.payment_status
        except Exception as e:
            logger.warning(f"Stripe status lookup failed for domain session {session_id}: {e}")

    update = {"payment_status": resolved_payment_status or doc.get("payment_status"), "updated_at": now_iso()}

    if resolved_payment_status == "paid" and doc.get("status") != "active":
        # 1) Registrar purchase (mocked)
        try:
            user = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "email": 1})
            receipt = await _mock_registrar_purchase(doc["domain_name"], user.get("email") if user else "unknown")
            update["registrar_order_id"] = receipt["registrar_order_id"]
            update["purchase_date"] = receipt["registration_date"]
            update["expiry_date"] = receipt["expiry_date"]
        except Exception as e:
            logger.error(f"Registrar order failed for {doc['domain_name']}: {e}")
            update["status"] = "error"
            update["error"] = "registrar_failed"
            await db.domains.update_one({"stripe_session_id": session_id}, {"$set": update})
            return await db.domains.find_one({"stripe_session_id": session_id}, {"_id": 0})

        # 2) DNS auto-configure (mocked — returns the config we would have applied)
        update["dns_config"] = _build_dns_config(doc["domain_name"])

        # 3) SSL auto-provisioning (mocked: Let's Encrypt via reverse proxy)
        update["ssl_status"] = "active"
        update["ssl_issuer"] = "Let's Encrypt (auto)"

        update["status"] = "active"
        update["activated_at"] = now_iso()

        # 4) Attach domain to its project so the site is served at this URL
        attached = await _auto_connect_domain_to_project({**doc, **update})
        if attached:
            update["attached_project"] = attached

    await db.domains.update_one({"stripe_session_id": session_id}, {"$set": update})
    return await db.domains.find_one({"stripe_session_id": session_id}, {"_id": 0})


# ---------- Status + listing ----------

@api_router.get("/domains")
async def list_domains(user: dict = Depends(current_user)):
    domains = await db.domains.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_project_domain_public(d) for d in domains]


@api_router.get("/domains/status/{session_id}")
async def domain_status(session_id: str, user: dict = Depends(current_user)):
    """Poll this from the success page to confirm activation."""
    doc = await db.domains.find_one({"stripe_session_id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Commande domaine introuvable")
    fresh = await _apply_domain_purchase_if_paid(session_id) or doc
    return _project_domain_public(fresh)


@api_router.post("/domains/{domain_id}/connect")
async def domain_connect_to_project(domain_id: str, body: Dict[str, Any], user: dict = Depends(current_user)):
    """Manually (re)attach a previously-purchased active domain to a project."""
    domain_doc = await db.domains.find_one({"id": domain_id, "user_id": user["id"]}, {"_id": 0})
    if not domain_doc:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    if domain_doc.get("status") != "active":
        raise HTTPException(status_code=400, detail="Domaine pas encore actif")
    project_id = body.get("project_id")
    project_kind = body.get("project_kind", "site")
    if project_kind not in ("site", "shop"):
        raise HTTPException(status_code=400, detail="project_kind invalide")
    coll = db.sites if project_kind == "site" else db.shops
    project = await coll.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    await db.domains.update_one({"id": domain_id}, {"$set": {"project_id": project_id, "project_kind": project_kind, "updated_at": now_iso()}})
    await coll.update_one(
        {"id": project_id},
        {"$set": {
            "custom_domain": domain_doc["domain_name"],
            "domain_verified": True,
            "domain_verified_at": now_iso(),
            "domain_token": None,
            "updated_at": now_iso(),
        }},
    )
    return {"ok": True, "domain": domain_doc["domain_name"], "project_id": project_id}





# =============================================================================
# ANALYTICS + DOMAIN REMINDERS / RENEWAL — Phase 6
# =============================================================================

DOMAIN_REMINDER_WINDOWS = [
    ("1d", 1),
    ("7d", 7),
    ("30d", 30),
]


def _month_ago_iso(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


async def _sum_totals(cursor) -> tuple:
    total_cents = 0
    count = 0
    async for doc in cursor:
        total_cents += int(doc.get("total_cents") or doc.get("amount_cents") or 0)
        count += 1
    return total_cents, count


@api_router.get("/analytics/summary")
async def analytics_summary(user: dict = Depends(current_user)):
    """Return a dashboard summary across sites, shops, leads, orders and domains for the current user."""
    user_id = user["id"]
    month_ago = _month_ago_iso(30)
    thirty_days_from_now = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()

    # Sites + shops counts
    sites_count = await db.sites.count_documents({"user_id": user_id})
    shops_count = await db.shops.count_documents({"user_id": user_id})

    # Leads total / last 30 days (across all user sites)
    user_sites = await db.sites.find({"user_id": user_id}, {"_id": 0, "id": 1}).to_list(500)
    site_ids = [s["id"] for s in user_sites]
    leads_total = await db.leads.count_documents({"site_id": {"$in": site_ids}}) if site_ids else 0
    leads_30d = await db.leads.count_documents({"site_id": {"$in": site_ids}, "created_at": {"$gte": month_ago}}) if site_ids else 0

    # Shop orders (paid only)
    user_shops = await db.shops.find({"user_id": user_id}, {"_id": 0, "id": 1}).to_list(500)
    shop_ids = [s["id"] for s in user_shops]
    orders_paid_filter = {"shop_id": {"$in": shop_ids}, "status": {"$in": ["paid", "shipped", "delivered"]}} if shop_ids else {"shop_id": "__none__"}
    orders_30d_filter = {**orders_paid_filter, "created_at": {"$gte": month_ago}} if shop_ids else orders_paid_filter
    orders_total_cents, orders_total_count = await _sum_totals(db.orders.find(orders_paid_filter, {"_id": 0, "total_cents": 1}))
    orders_30d_cents, orders_30d_count = await _sum_totals(db.orders.find(orders_30d_filter, {"_id": 0, "total_cents": 1}))
    avg_basket_cents = int(orders_total_cents / orders_total_count) if orders_total_count else 0

    # Top products (by units sold among paid orders) — MVP: loop in Python
    product_sales: Dict[str, dict] = {}
    if shop_ids:
        async for o in db.orders.find(orders_paid_filter, {"_id": 0, "items": 1}):
            for item in o.get("items", []) or []:
                pid = item.get("product_id")
                if not pid:
                    continue
                entry = product_sales.setdefault(pid, {"product_id": pid, "name": item.get("name"), "units": 0, "revenue_cents": 0})
                entry["units"] += int(item.get("qty") or 0)
                entry["revenue_cents"] += int(item.get("line_total_cents") or 0)
    top_products = sorted(product_sales.values(), key=lambda e: e["revenue_cents"], reverse=True)[:5]

    # Domains
    domains_all = await db.domains.find({"user_id": user_id, "status": "active"}, {"_id": 0}).to_list(200)
    domains_active_count = len(domains_all)
    domains_total_cents = sum(int(d.get("amount_cents") or 0) for d in domains_all)
    domains_30d_cents = sum(
        int(d.get("amount_cents") or 0) for d in domains_all if (d.get("activated_at") or d.get("purchase_date") or "") >= month_ago
    )
    domains_expiring_soon = [
        {
            "id": d["id"],
            "domain_name": d["domain_name"],
            "expiry_date": d["expiry_date"],
            "auto_renew": bool(d.get("auto_renew")),
            "days_left": max(0, (datetime.fromisoformat(d["expiry_date"]).replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days) if d.get("expiry_date") else None,
        }
        for d in domains_all
        if d.get("expiry_date") and d["expiry_date"] <= thirty_days_from_now
    ]
    domains_expiring_soon.sort(key=lambda d: d["expiry_date"])

    # Monthly series (last 6 months) — CA combined shop + domains
    series: List[dict] = []
    for i in range(5, -1, -1):
        month_start = (datetime.now(timezone.utc).replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_start_iso = month_start.isoformat()
        month_end_iso = month_end.isoformat()
        orders_month_cents, _ = await _sum_totals(db.orders.find({
            **orders_paid_filter,
            "created_at": {"$gte": month_start_iso, "$lt": month_end_iso},
        }, {"_id": 0, "total_cents": 1})) if shop_ids else (0, 0)
        domains_month_cents = sum(
            int(d.get("amount_cents") or 0) for d in domains_all
            if (d.get("activated_at") or d.get("purchase_date") or "") >= month_start_iso and (d.get("activated_at") or d.get("purchase_date") or "") < month_end_iso
        )
        series.append({
            "month": month_start.strftime("%Y-%m"),
            "shop_cents": orders_month_cents,
            "domain_cents": domains_month_cents,
            "total_cents": orders_month_cents + domains_month_cents,
        })

    return {
        "sites_count": sites_count,
        "shops_count": shops_count,
        "leads": {"total": leads_total, "last_30d": leads_30d},
        "orders": {
            "total_cents": orders_total_cents,
            "total_count": orders_total_count,
            "last_30d_cents": orders_30d_cents,
            "last_30d_count": orders_30d_count,
            "avg_basket_cents": avg_basket_cents,
            "top_products": top_products,
        },
        "domains": {
            "active_count": domains_active_count,
            "total_cents": domains_total_cents,
            "last_30d_cents": domains_30d_cents,
            "expiring_soon": domains_expiring_soon,
        },
        "monthly_series": series,
        "currency": "EUR",
    }


# ---------- Domain auto-renewal toggle ----------

class AutoRenewIn(BaseModel):
    auto_renew: bool


@api_router.put("/domains/{domain_id}/auto-renew")
async def update_auto_renew(domain_id: str, body: AutoRenewIn, user: dict = Depends(current_user)):
    doc = await db.domains.find_one({"id": domain_id, "user_id": user["id"]}, {"_id": 0, "id": 1, "status": 1})
    if not doc:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    await db.domains.update_one({"id": domain_id}, {"$set": {"auto_renew": body.auto_renew, "updated_at": now_iso()}})
    return {"ok": True, "auto_renew": body.auto_renew}


# ---------- Renewal checkout (one-click from email reminder or dashboard) ----------

class DomainRenewIn(BaseModel):
    origin_url: str


@api_router.post("/domains/{domain_id}/renew")
async def create_renewal_checkout(domain_id: str, body: DomainRenewIn, user: dict = Depends(current_user)):
    doc = await db.domains.find_one({"id": domain_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Paiement non configuré")
    pricing = _tld_price(doc.get("tld", ""))
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/domain/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/domain/cancel"
    webhook_url = f"{origin}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    metadata = {
        "kind": "domain_renewal",
        "domain_id": domain_id,
        "domain": doc["domain_name"],
        "user_id": user["id"],
    }
    req = CheckoutSessionRequest(
        amount=float(pricing["total_cents"]) / 100.0,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)
    now = now_iso()
    renewal = {
        "id": str(uuid.uuid4()),
        "domain_id": domain_id,
        "user_id": user["id"],
        "domain_name": doc["domain_name"],
        "amount_cents": pricing["total_cents"],
        "currency": "EUR",
        "stripe_session_id": session.session_id,
        "payment_status": "initiated",
        "status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    await db.domain_renewals.insert_one(renewal)
    return {"url": session.url, "session_id": session.session_id, "amount_cents": pricing["total_cents"]}


async def _apply_domain_renewal_if_paid(session_id: str) -> Optional[dict]:
    renewal = await db.domain_renewals.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not renewal:
        return None
    if renewal.get("status") == "applied":
        return renewal
    resolved = renewal.get("payment_status")
    if resolved != "paid" and STRIPE_API_KEY:
        try:
            stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
            status_resp = await stripe_checkout.get_checkout_status(session_id)
            resolved = status_resp.payment_status
        except Exception as e:
            logger.warning(f"Stripe lookup failed for renewal {session_id}: {e}")
    update = {"payment_status": resolved, "updated_at": now_iso()}
    if resolved == "paid" and renewal.get("status") != "applied":
        # Extend domain expiry by 365 days from current expiry (or now if already expired)
        domain_doc = await db.domains.find_one({"id": renewal["domain_id"]})
        if domain_doc:
            try:
                current_exp = datetime.fromisoformat(domain_doc.get("expiry_date")) if domain_doc.get("expiry_date") else datetime.now(timezone.utc)
                if current_exp.tzinfo is None:
                    current_exp = current_exp.replace(tzinfo=timezone.utc)
                if current_exp < datetime.now(timezone.utc):
                    current_exp = datetime.now(timezone.utc)
            except Exception:
                current_exp = datetime.now(timezone.utc)
            new_exp = (current_exp + timedelta(days=365)).isoformat()
            await db.domains.update_one(
                {"id": renewal["domain_id"]},
                {"$set": {
                    "expiry_date": new_exp,
                    "last_renewed_at": now_iso(),
                    "reminders_sent": [],  # reset so new cycle can send reminders again
                    "updated_at": now_iso(),
                }},
            )
            update["status"] = "applied"
            update["new_expiry_date"] = new_exp
    await db.domain_renewals.update_one({"stripe_session_id": session_id}, {"$set": update})
    return await db.domain_renewals.find_one({"stripe_session_id": session_id}, {"_id": 0})


# ---------- Domain renewal reminder cron ----------

def _render_reminder_email(domain_name: str, days_left: int, renew_link: str) -> str:
    urgency_color = "#C84B31" if days_left <= 7 else "#F95A2C"
    urgency_label = "urgent" if days_left <= 1 else ("bientôt" if days_left <= 7 else "à venir")
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; background:#FAFAFA; padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff; border:1px solid #E4E4E7;">
          <tr><td style="padding:32px 32px 0; border-bottom:4px solid {urgency_color};">
            <div style="font-family:monospace; font-size:10px; letter-spacing:.2em; text-transform:uppercase; color:#71717A; margin-bottom:8px;">// rappel · {urgency_label}</div>
            <h1 style="margin:0 0 8px; font-size:28px; color:#09090B; font-weight:800;">{domain_name} expire dans <span style="color:{urgency_color};">{days_left} jour{'s' if days_left > 1 else ''}</span></h1>
            <p style="margin:0 0 24px; color:#52525B; font-size:14px;">Renouvelez en un clic — votre site reste en ligne sans interruption. Si vous ne renouvelez pas, le domaine sera libéré à sa date d'expiration.</p>
          </td></tr>
          <tr><td style="padding:24px 32px 32px;">
            <a href="{renew_link}" style="display:inline-block; background:#F95A2C; color:#fff; padding:14px 28px; text-decoration:none; font-weight:600;">Renouveler maintenant →</a>
            <p style="margin:24px 0 0; color:#71717A; font-size:12px;">Besoin d'aide ? Répondez simplement à cet email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def _send_domain_reminders_impl() -> dict:
    """Scan active domains and send reminder emails at 30/7/1 day thresholds.
    Stores `reminders_sent` on the domain doc to prevent duplicates.
    Returns a summary dict. Idempotent.
    """
    now = datetime.now(timezone.utc)
    # Pull all domains with an expiry in the coming 31 days
    cursor = db.domains.find({
        "status": "active",
        "expiry_date": {"$lte": (now + timedelta(days=31)).isoformat()},
    }, {"_id": 0})
    sent: List[dict] = []
    errors: List[dict] = []
    async for d in cursor:
        try:
            exp = datetime.fromisoformat(d["expiry_date"])
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            days_left = max(0, (exp - now).days)
        except Exception:
            continue
        already = set(d.get("reminders_sent") or [])
        # Pick the tightest window that applies; only send if not already sent at that window.
        # (If tightest already sent, do nothing — don't escalate to a broader window.)
        chosen_label: Optional[str] = None
        for label, threshold in DOMAIN_REMINDER_WINDOWS:
            if days_left <= threshold:
                if label not in already:
                    chosen_label = label
                break
        if not chosen_label:
            continue
        user = await db.users.find_one({"id": d["user_id"]}, {"_id": 0, "email": 1})
        if not user or not user.get("email"):
            continue
        # Renewal link: dashboard deep-link. Frontend handles "one-click renew" button inside /domains.
        renew_link = f"{os.environ.get('PUBLIC_APP_URL', '').rstrip('/') or 'https://aisite-builder-8.preview.emergentagent.com'}/domains?renew={d['id']}"
        try:
            await asyncio.to_thread(
                _send_email_sync,
                user["email"],
                f"[{chosen_label}] Votre domaine {d['domain_name']} expire bientôt",
                _render_reminder_email(d["domain_name"], days_left, renew_link),
            )
            await db.domains.update_one(
                {"id": d["id"]},
                {"$addToSet": {"reminders_sent": chosen_label}, "$set": {"updated_at": now_iso()}},
            )
            sent.append({"domain_id": d["id"], "domain_name": d["domain_name"], "label": chosen_label, "email": user["email"], "days_left": days_left})
        except Exception as e:
            logger.error(f"Reminder email failed for {d['domain_name']}: {e}")
            errors.append({"domain_id": d["id"], "error": str(e)})
    return {"sent": sent, "errors": errors, "processed_at": now_iso()}


@api_router.post("/admin/cron/domain-reminders")
async def run_domain_reminders(_admin: dict = Depends(admin_only)):
    """Admin-triggered (or cron-triggered) reminder dispatch. Idempotent."""
    return await _send_domain_reminders_impl()


# Plug renewal dispatch into the webhook router as well
async def _stripe_webhook_dispatch_renewal(session_id: str) -> bool:
    """Return True if session_id was a domain renewal session (and handled)."""
    renewal = await db.domain_renewals.find_one({"stripe_session_id": session_id}, {"_id": 0, "id": 1})
    if not renewal:
        return False
    await _apply_domain_renewal_if_paid(session_id)
    return True




# =============================================================================
# STRIPE SUBSCRIPTION — Domain auto-renewal via recurring billing (Phase 6.1)
# =============================================================================


class DomainAutoRenewSubscribeIn(BaseModel):
    origin_url: str


@api_router.post("/domains/{domain_id}/auto-renew/subscribe")
async def create_auto_renew_subscription(domain_id: str, body: DomainAutoRenewSubscribeIn, user: dict = Depends(current_user)):
    """Create a Stripe Subscription checkout session (mode=subscription) with a yearly
    recurring Price that matches the TLD pricing. On successful checkout, the Stripe
    customer + subscription IDs are persisted on the domain and auto_renew is set True.
    """
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Paiement non configuré")

    doc = await db.domains.find_one({"id": domain_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    if doc.get("status") != "active":
        raise HTTPException(status_code=400, detail="Domaine pas encore actif")
    if doc.get("stripe_subscription_id") and doc.get("auto_renew"):
        raise HTTPException(status_code=409, detail="Renouvellement auto déjà activé")

    pricing = _tld_price(doc.get("tld", ""))
    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/domain/auto-renew-success?session_id={{CHECKOUT_SESSION_ID}}&domain_id={domain_id}"
    cancel_url = f"{origin}/domains"

    try:
        session = await asyncio.to_thread(
            stripe_sdk.checkout.Session.create,
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{
                "quantity": 1,
                "price_data": {
                    "currency": "eur",
                    "product_data": {
                        "name": f"Renouvellement auto — {doc['domain_name']}",
                        "description": f"Renouvellement annuel automatique du domaine {doc['domain_name']}",
                    },
                    "unit_amount": pricing["total_cents"],
                    "recurring": {"interval": "year", "interval_count": 1},
                },
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user.get("email"),
            metadata={
                "kind": "domain_auto_renew_subscription",
                "domain_id": domain_id,
                "user_id": user["id"],
                "domain_name": doc["domain_name"],
            },
            subscription_data={
                "metadata": {
                    "kind": "domain_auto_renew_subscription",
                    "domain_id": domain_id,
                    "user_id": user["id"],
                    "domain_name": doc["domain_name"],
                },
            },
        )
    except Exception as e:
        logger.error(f"Stripe subscription session creation failed: {e}")
        raise HTTPException(status_code=502, detail=f"Stripe indisponible: {str(e)[:100]}")

    await db.domains.update_one(
        {"id": domain_id},
        {"$set": {
            "auto_renew_session_id": session.id,
            "auto_renew_pending": True,
            "updated_at": now_iso(),
        }},
    )
    return {"url": session.url, "session_id": session.id}


@api_router.get("/domains/{domain_id}/auto-renew/status/{session_id}")
async def domain_auto_renew_status(domain_id: str, session_id: str, user: dict = Depends(current_user)):
    """Poll after the user returns from Stripe — fetch session, attach subscription to domain."""
    doc = await db.domains.find_one({"id": domain_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    if doc.get("auto_renew") and doc.get("stripe_subscription_id"):
        return {"auto_renew": True, "subscription_id": doc["stripe_subscription_id"]}
    if not STRIPE_API_KEY:
        return {"auto_renew": False}

    try:
        session = await asyncio.to_thread(stripe_sdk.checkout.Session.retrieve, session_id)
    except Exception as e:
        logger.warning(f"Failed to retrieve subscription session {session_id}: {e}")
        return {"auto_renew": False, "pending": True}

    subscription_id = getattr(session, "subscription", None)
    customer_id = getattr(session, "customer", None)
    payment_status = getattr(session, "payment_status", None) or getattr(session, "status", None)

    if not subscription_id:
        return {"auto_renew": False, "pending": True, "payment_status": payment_status}

    await db.domains.update_one(
        {"id": domain_id},
        {"$set": {
            "auto_renew": True,
            "stripe_subscription_id": subscription_id,
            "stripe_customer_id": customer_id,
            "auto_renew_pending": False,
            "auto_renew_activated_at": now_iso(),
            "updated_at": now_iso(),
        }},
    )
    return {"auto_renew": True, "subscription_id": subscription_id}


@api_router.post("/domains/{domain_id}/auto-renew/cancel")
async def cancel_auto_renew_subscription(domain_id: str, user: dict = Depends(current_user)):
    """Cancel the Stripe subscription at period end. User keeps coverage until expiry."""
    doc = await db.domains.find_one({"id": domain_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Domaine introuvable")
    sub_id = doc.get("stripe_subscription_id")
    if not sub_id:
        await db.domains.update_one({"id": domain_id}, {"$set": {"auto_renew": False, "updated_at": now_iso()}})
        return {"ok": True, "auto_renew": False}
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Paiement non configuré")
    try:
        await asyncio.to_thread(
            stripe_sdk.Subscription.modify,
            sub_id,
            cancel_at_period_end=True,
        )
    except Exception as e:
        logger.error(f"Stripe subscription cancel failed for {sub_id}: {e}")
        raise HTTPException(status_code=502, detail="Impossible d'annuler côté Stripe")
    await db.domains.update_one(
        {"id": domain_id},
        {"$set": {
            "auto_renew": False,
            "auto_renew_cancelled_at": now_iso(),
            "updated_at": now_iso(),
        }},
    )
    return {"ok": True, "auto_renew": False, "cancel_at_period_end": True}


@api_router.post("/webhook/stripe/subscriptions")
async def stripe_subscription_webhook(request: Request):
    """Separate Stripe webhook for subscription events.
    Events handled: invoice.payment_succeeded (renewal), customer.subscription.updated/deleted,
    invoice.payment_failed (notify user).
    """
    if not STRIPE_API_KEY:
        return {"ok": False}
    payload = await request.body()
    sig = request.headers.get("Stripe-Signature", "")

    event: Any = None
    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe_sdk.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        except Exception as e:
            logger.error(f"Subscription webhook signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        try:
            event = json.loads(payload.decode("utf-8"))
        except Exception as e:
            logger.error(f"Subscription webhook parse failed: {e}")
            return {"ok": False}

    def _g(obj: Any, key: str, default: Any = None) -> Any:
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    event_type = _g(event, "type")
    data = _g(_g(event, "data", {}), "object", {})
    if not event_type:
        return {"ok": False}

    if event_type == "invoice.payment_succeeded":
        sub_id = _g(data, "subscription")
        if not sub_id:
            return {"ok": True}
        doc = await db.domains.find_one({"stripe_subscription_id": sub_id}, {"_id": 0})
        if not doc:
            return {"ok": True}
        billing_reason = _g(data, "billing_reason")
        if billing_reason == "subscription_create":
            return {"ok": True}
        try:
            current_exp = datetime.fromisoformat(doc.get("expiry_date")) if doc.get("expiry_date") else datetime.now(timezone.utc)
            if current_exp.tzinfo is None:
                current_exp = current_exp.replace(tzinfo=timezone.utc)
            if current_exp < datetime.now(timezone.utc):
                current_exp = datetime.now(timezone.utc)
        except Exception:
            current_exp = datetime.now(timezone.utc)
        new_exp = (current_exp + timedelta(days=365)).isoformat()
        await db.domains.update_one(
            {"id": doc["id"]},
            {"$set": {
                "expiry_date": new_exp,
                "last_renewed_at": now_iso(),
                "reminders_sent": [],
                "updated_at": now_iso(),
            }},
        )
        await db.domain_renewals.insert_one({
            "id": str(uuid.uuid4()),
            "domain_id": doc["id"],
            "user_id": doc["user_id"],
            "domain_name": doc["domain_name"],
            "amount_cents": _g(data, "amount_paid") or _g(data, "amount_due") or doc.get("amount_cents"),
            "currency": (_g(data, "currency") or "eur").upper(),
            "stripe_invoice_id": _g(data, "id"),
            "stripe_subscription_id": sub_id,
            "source": "subscription",
            "status": "applied",
            "payment_status": "paid",
            "new_expiry_date": new_exp,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        logger.info(f"Domain {doc['domain_name']} auto-renewed via sub {sub_id}; new expiry {new_exp}")
        return {"ok": True}

    if event_type == "customer.subscription.updated":
        sub_id = _g(data, "id")
        cancel_at_period_end = bool(_g(data, "cancel_at_period_end"))
        status = _g(data, "status")
        update: Dict[str, Any] = {"updated_at": now_iso()}
        if cancel_at_period_end or status in ("canceled", "unpaid", "incomplete_expired"):
            update["auto_renew"] = False
        await db.domains.update_one({"stripe_subscription_id": sub_id}, {"$set": update})
        return {"ok": True}

    if event_type == "customer.subscription.deleted":
        sub_id = _g(data, "id")
        await db.domains.update_one(
            {"stripe_subscription_id": sub_id},
            {"$set": {"auto_renew": False, "stripe_subscription_id": None, "updated_at": now_iso()}},
        )
        return {"ok": True}

    if event_type == "invoice.payment_failed":
        sub_id = _g(data, "subscription")
        if sub_id:
            doc = await db.domains.find_one({"stripe_subscription_id": sub_id}, {"_id": 0, "id": 1, "domain_name": 1, "user_id": 1})
            if doc:
                user_doc = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "email": 1})
                if user_doc and user_doc.get("email"):
                    try:
                        await asyncio.to_thread(
                            _send_email_sync,
                            user_doc["email"],
                            f"Paiement échoué pour le renouvellement de {doc['domain_name']}",
                            f"<p>Le paiement automatique du renouvellement de <b>{doc['domain_name']}</b> a échoué. Merci de mettre à jour votre moyen de paiement dans votre dashboard.</p>",
                        )
                    except Exception as e:
                        logger.error(f"Failed to send payment failure email: {e}")
        return {"ok": True}

    return {"ok": True}


# ---- Mount router & CORS ----
app.include_router(api_router)
import json
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
 
    allow_origins=json.loads(os.environ.get('CORS_ORIGINS', '["*"]')),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
