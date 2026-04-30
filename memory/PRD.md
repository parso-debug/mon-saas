# PRD — artisanweb (SaaS Website-as-a-Service)

## Original Problem Statement
Build a SaaS web application that auto-generates professional websites for French artisans/SMBs from a simple form. AI generates content (SEO-optimized French), structure, and design. Sites are publishable in 1 click, with light CRM for leads.

## Architecture
- **Backend**: FastAPI + MongoDB + JWT auth + Claude Sonnet 4.5 (content) + Gemini 3.1 Nano Banana (images via Object Storage) + Stripe Checkout + Resend
- **Frontend**: React 19 + Tailwind + shadcn/ui, two design themes:
  - **SaaS app** — Swiss High-Contrast: Bricolage Grotesque + Geist + Space Mono, accent `#F95A2C` orange + `#09090B` near-black
  - **Generated artisan template** — Organic & Earthy: Instrument Serif + Manrope, deep green `#1F3D2D` + terra `#C84B31`

## Core Requirements
1. Onboarding multi-étapes (entreprise / services / coordonnées / style)
2. Génération IA en français (Claude) avec SEO local
3. Image hero + logo IA optionnels (Nano Banana)
4. Aperçu temps réel + édition inline + éditeur multi-champs structuré
5. Publication (URL `/site/:slug`, partageable + domaine custom)
6. CRM léger (capture leads + email notification + inbox)
7. Multi-tenant (isolation stricte des données par user)
8. Auth JWT (30j)
9. Billing Stripe (Free / Pro 19€/mois)

## Implemented (Feb 2026)

### Phase 1 — MVP
- ✅ Auth JWT + bcrypt
- ✅ Onboarding wizard 4 étapes (15 métiers + saisie libre)
- ✅ AI generation: Claude Sonnet 4.5 (~18-25s) + Gemini Nano Banana (~30-60s)
- ✅ Builder: preview + inline edit + settings + leads inbox + publish
- ✅ Public site `/site/:slug` avec SEO meta dynamique
- ✅ Lead capture + leads inbox
- ✅ Multi-tenant isolation (28/28 tests)
- ✅ Marketing landing premium

### Phase 2 — P0
- ✅ Génération de logo IA (POST /api/sites/{id}/regenerate-logo)
- ✅ Régénération du hero (POST /api/sites/{id}/regenerate-hero)
- ✅ Éditeur multi-champs structuré (Builder → onglet "Contenu") couvrant tagline, hero, value_props, services, about, why_us, contact, SEO
- ✅ Notifications email leads (Resend) — skip silencieux si RESEND_API_KEY vide

### Phase 2 — P1
- ✅ Stripe Checkout (pro_monthly 19€ / pro_yearly 190€)
- ✅ Pages /billing, /billing/success, /billing/cancel
- ✅ Webhook /api/webhook/stripe + idempotent pro_until extension
- ✅ Free tier enforcement: limite à 1 site (HTTP 402 sinon)
- ✅ Banner Pro/Free dans le Dashboard avec CTA upgrade
- ✅ Custom domain field + instructions DNS dans Settings
- ✅ Google Maps iframe embed dans la section Contact

### Phase 2 — P2
- ✅ Object storage migration: images IA stockées sur Emergent Object Storage et servies via `/api/files/{path}` (cache immutable 1 an)
- ✅ Fallback base64 si l'upload storage échoue (rétrocompatibilité)
- ✅ Soft-delete via collection `db.files`

## Tests
- **iter 1 (MVP)**: 28/28 ✅
- **iter 2 (P0+P1+P2)**: 18/19 PASS (1 XFAIL = bug confirmé)
- **iter 3 (bug fixes)**: 8/8 PASS pour fixes ciblés ; phase2 14/14 ; iter1 26/27 (1 test coupling avec free tier limit, à fixer plus tard)

## Backlog

### P3 (next)
- Stripe webhook signature verification (besoin d'une clé webhook secret réelle)
- Refresh token + logout/blacklist
- Régénération partielle ciblée d'une section (ex: hero seul)
- Templates de design alternatifs (au-delà d'"Organic & Earthy")
- Analytics (visites, leads/jour) dans Dashboard
- Vérification du domaine personnalisé (DNS lookup côté serveur)

### P4 (Scale)
- Multi-langues (en, es)
- Avis Google auto-importés
- Génération de pages additionnelles (Blog, Réalisations, FAQ)
- A/B testing CTA
- Tests E2E Playwright complets

## Configuration .env (backend)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
EMERGENT_LLM_KEY=<emergent universal key>
JWT_SECRET=<random>
STRIPE_API_KEY=sk_test_emergent
RESEND_API_KEY=          # vide = email skip silencieux
SENDER_EMAIL=onboarding@resend.dev
```

## Known Limitations
- `STRIPE_API_KEY=sk_test_emergent` ne supporte pas le retrieve, donc /billing/status renvoie `lookup_error: true` jusqu'à payment réel ou clé Stripe test custom.
- Pas de validation de signature Stripe webhook pour l'instant.
- RESEND_API_KEY vide par défaut: les emails sont loggés mais pas envoyés.
- Les anciennes sites avec base64 inline ne sont pas migrés rétroactivement vers object storage.
