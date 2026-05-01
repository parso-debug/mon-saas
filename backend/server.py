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
            await _apply_pro_credit_if_paid(event.session_id)
        return {"ok": True}
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
        return {"ok": False}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"service": "ArtisanWeb API", "ok": True}


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
