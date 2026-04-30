# PRD — artisanweb (SaaS Website-as-a-Service)

## Original Problem Statement
Build a SaaS web application that auto-generates professional websites for French artisans/SMBs from a simple form. AI generates content (SEO-optimized French), structure, and design. Sites are publishable in 1 click, with light CRM for leads.

## Architecture
- **Backend**: FastAPI + MongoDB + JWT auth + Claude Sonnet 4.5 (content) + Gemini 3.1 Nano Banana (hero images) via Emergent Universal LLM Key
- **Frontend**: React 19 + Tailwind + shadcn/ui, two design themes:
  - **SaaS app** — Swiss High-Contrast: Bricolage Grotesque + Geist + Space Mono, accent `#F95A2C` orange + `#09090B` near-black
  - **Generated artisan template** — Organic & Earthy: Instrument Serif + Manrope, deep green `#1F3D2D` + terra `#C84B31`
- **Routing**: Public `/`, `/login`, `/signup`, `/site/:slug`. Protected `/dashboard`, `/onboarding`, `/generating`, `/builder/:siteId`.

## User Personas
- Marc, maçon à Toulouse, 45 ans, peu technique, veut un site pour récupérer des devis.
- Sophie, gérante d'une PME de rénovation à Lyon, veut centraliser ses leads.

## Core Requirements (Static)
1. Onboarding multi-étapes (entreprise / services / coordonnées / style)
2. Génération IA en français (Claude) avec SEO local
3. Image hero IA optionnelle (Nano Banana)
4. Aperçu temps réel + édition inline (contenteditable)
5. Publication (URL `/site/:slug`, partageable)
6. CRM léger (capture leads via formulaire intégré, inbox dans le builder)
7. Multi-tenant (isolation stricte des données par user)
8. Auth JWT (30j)

## Implemented (Feb 2026)
- ✅ Auth JWT (register / login / me) + bcrypt
- ✅ Onboarding wizard 4 étapes (15 métiers prédéfinis + saisie libre)
- ✅ AI generation : Claude Sonnet 4.5 (~18-25s) + Gemini Nano Banana (~30-60s)
- ✅ Builder : preview + inline edit + settings + leads inbox + publish
- ✅ Public site `/site/:slug` avec SEO meta dynamique (title/description/keywords)
- ✅ Lead capture (public form) + leads inbox (auth)
- ✅ Multi-tenant isolation (vérifié par 28 tests backend)
- ✅ Slug uniqueness + delete cascade des leads
- ✅ Marketing landing page (hero / how-it-works / features bento / testimonial / pricing / CTA)
- ✅ Tests backend : 100% (28/28)

## Backlog / Roadmap

### P0 (next sprint)
- Génération de logo IA (Nano Banana avec ref)
- Email notifications (SendGrid / Resend) pour nouveaux leads
- Edition multi-champs (services, why_us, value_props avec UI dédiée — actuellement seuls hero/about éditables inline)
- Régénération partielle d'une section (ex: refaire que le hero)

### P1 (V1)
- Domaine personnalisé (CNAME + Let's Encrypt)
- Stripe billing (Free 1 site / Pro 19€/mois illimité)
- Google Maps embed dans la page contact
- Avis Google auto-importés
- Génération de pages additionnelles (Blog, Réalisations, FAQ)
- A/B testing sur les CTA hero

### P2 (Scale)
- Object storage S3 pour les images (actuellement base64 inline → alourdit les docs Mongo)
- Multi-langues (en, es)
- Templates additionnels (au-delà de "Organic & Earthy")
- Dashboard analytics (visites, conversions)
- Refresh tokens + logout blacklist
- Tests E2E Playwright

## Known Limitations
- Hero images stockées en base64 inline dans MongoDB (gros payloads). À migrer vers object storage en P2.
- Pas de notifications email pour les leads (à ajouter en P0).
- Pas de paiement Stripe encore (à ajouter en P1).
- L'éditeur inline ne couvre que hero_title / hero_subtitle / hero_cta / about_text. Les services/value_props ne sont pas éditables inline.

## Testing
- Backend regression suite: `/app/backend/tests/test_artisanweb.py` — 28 tests, ~75-90s, includes 1 real Gemini image gen call.
- Test credentials: dynamically generated per run, password `testpass123`.
