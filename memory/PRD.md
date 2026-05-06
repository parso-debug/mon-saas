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

### Phase 3 — Personnalisation visuelle (May 2026)
- ✅ Theme picker dans le Builder (onglet Design): 6 presets de palette + 6 couples de polices Google Fonts + color pickers HEX
- ✅ Drag & Drop (`@dnd-kit`) de l'ordre des sections du site (hero / value_props / services / about / contact); header + footer fixes
- ✅ `theme` (primary_color, accent_color, font_heading, font_body) et `section_order` persistés via PUT /api/sites/{id}
- ✅ Rendu live dans l'aperçu builder + sur le site public via `<style>` injecté ciblant les classes Tailwind arbitraires

### Phase 4 — E-commerce (May 2026)
- ✅ Back-office marchand (Pro-only) `/shop-builder/:id` : onglets Produits / Commandes / Livraison / Paramètres
- ✅ CRUD Shop / Product / Order (MongoDB `shops`, `products`, `orders`)
- ✅ Produits avec photos (Object Storage via POST /api/shops/{id}/upload-image), variantes simples ({name, options}), stock, catégorie, prix barré
- ✅ Tarifs de livraison configurables (défaut: Retrait boutique gratuit / France métro 4,90€ / UE 9,90€)
- ✅ TVA 20% incluse par défaut, modifiable par marchand
- ✅ Public storefront `/shop/:slug` (catalogue + /product/:pslug + cart drawer localStorage + checkout + success)
- ✅ Checkout Stripe : POST /api/public/shops/{slug}/checkout → session Stripe + Order(status=pending)
- ✅ Webhook /api/webhook/stripe dispatché vers `_apply_shop_order_if_paid` (idempotent, décrément stock, emails Resend client + propriétaire)
- ✅ Pro gating : free user reçoit 402, redirection vers /billing
- ✅ Multi-tenant isolation (user A ne voit pas shops/products/orders de user B — 29/29 tests pytest)
- ✅ **Admin endpoint** `POST /api/admin/users/grant-pro {email, days}` pour offrir du Pro manuellement (support client, démos)
- ✅ **Seed script** `python -m seed_demo_shop` : crée le compte `demo.pro@artisanweb.fr` / `demo1234` + boutique `/shop/la-boutique-de-demo` avec 3 produits + 1 commande d'exemple

### Phase 4.1 — Shopify-light upgrade + Landing CTA (May 2026)
- ✅ **CTA dédié sur la Landing** (`#shop`) : "Commerçant ? Votre boutique ouverte 24/7" avec preview mock 4 produits + carte commande flottante, bouton principal → `/signup?intent=shop`, bouton secondaire → démo publique
- ✅ **Lien Boutique** dans la nav principale
- ✅ **Signup `?intent=shop`** : redirige après register vers `/onboarding-shop` au lieu de `/onboarding` ; panneau droit adapté avec features boutique
- ✅ **Page `/onboarding-shop`** : upsell Pro (Crown + features + CTA billing) pour free users / formulaire de création pour pro users → redirection vers /shop-builder/{id} après create
- ✅ **Public shop upgradé** : hero sombre avec preview 4 produits, chips de catégories filtrables, badges remise (-X%) + stock bas ("Plus que N en stock") + overlay rupture de stock

### Phase 5 — Domain Marketplace MVP (May 2026)
- ✅ Achat de domaine depuis le Dashboard en 2 clics : recherche → Stripe → activation automatique
- ✅ `GET /api/domains/search` : WHOIS mocké déterministe (hash SHA256 %4 = taken) + suggestions intelligentes basées sur business_type + city (ex : `plombier-paris.fr`, `le-plombier-paris.fr`, `plombier-paris.shop` ...) — 12 suggestions max
- ✅ Pricing par TLD avec **marge fixe 10€/an** : .fr 19€, .com 24€, .shop 45€, .boutique 40€, .eu 18€, .net 23€, .bzh 35€, .paris 40€ ; fallback 22€
- ✅ `POST /api/domains/purchase` : crée session Stripe + insert `db.domains` (status=pending, provider=mock-registrar, expiry=+365j)
- ✅ `_apply_domain_purchase_if_paid` : registrar mocké + DNS config (A @ + A www + CAA letsencrypt) + SSL auto (Let's Encrypt mocké) + auto-attach au projet (site ou shop → custom_domain set, domain_verified=true)
- ✅ Frontend : `DomainManager.jsx` composant (search debounced + suggestions + états loading/available/taken/pending/active), page `/domains` dans la nav Dashboard, `/domain/success` avec polling + affichage DNS records, `/domain/cancel`
- ✅ Pensé swappable : `_mock_registrar_purchase` → remplaçable en 1h par Namecheap/Gandi/OpenProvider API call (contrat `{registrar_order_id, registration_date, expiry_date}`)

### Phase 6 — Analytics + Domain Reminders & Renewal (May 2026)
- ✅ **Analytics widget sur le Dashboard** : `GET /api/analytics/summary` (user-scoped) avec 4 KPIs (CA total, commandes, leads reçus, domaines actifs), bar chart 6 derniers mois (breakdown boutique vs domaines), alerte "Renouvellements à venir" si domaines <=30j, top 5 produits
- ✅ **`PUT /api/domains/{id}/auto-renew`** : toggle auto-renewal flag sur le domaine
- ✅ **`POST /api/domains/{id}/renew {origin_url}`** : crée une session Stripe + `db.domain_renewals`, qui sur `paid` étend l'expiry_date de +365j et reset les reminders_sent (nouveau cycle)
- ✅ **Webhook dispatcher étendu** : domain_purchase → domain_renewal → shop_order → pro_credit (idempotent, 4 voies)
- ✅ **`POST /api/admin/cron/domain-reminders`** (admin_only) : scan les domaines actifs, envoie des rappels email Resend à 30j/7j/1j (windows itérés du plus serré au plus large → on prend le tightest applicable non encore envoyé, pas d'escalade), marque `reminders_sent[]` sur le domaine (idempotent)
- ✅ **Template email** : bandeau urgence-adaptative (rouge <7j, orange >7j), CTA one-click `"Renouveler maintenant"` avec lien `/domains?renew=<id>` → frontend auto-trigger le POST /renew au mount → redirection Stripe immédiate
- ✅ **Frontend DomainManager** : bouton "Renouveler (XX€)" + badge "Expire dans X jours" + checkbox "Renouvellement auto" sur chaque domaine actif
- ✅ Achat de domaine depuis le Dashboard en 2 clics : recherche → Stripe → activation automatique
- ✅ `GET /api/domains/search` : WHOIS mocké déterministe (hash SHA256 %4 = taken) + suggestions intelligentes basées sur business_type + city (ex : `plombier-paris.fr`, `le-plombier-paris.fr`, `plombier-paris.shop` ...) — 12 suggestions max
- ✅ Pricing par TLD avec **marge fixe 10€/an** : .fr 19€, .com 24€, .shop 45€, .boutique 40€, .eu 18€, .net 23€, .bzh 35€, .paris 40€ ; fallback 22€
- ✅ `POST /api/domains/purchase` : crée session Stripe + insert `db.domains` (status=pending, provider=mock-registrar, expiry=+365j)
- ✅ Webhook dispatcher étendu : domain_purchase → shop_order → pro_credit (idempotent)
- ✅ `_apply_domain_purchase_if_paid` : registrar mocké + DNS config (A @ + A www + CAA letsencrypt) + SSL auto (Let's Encrypt mocké) + auto-attach au projet (site ou shop → custom_domain set, domain_verified=true)
- ✅ Frontend : `DomainManager.jsx` composant (search debounced + suggestions + états loading/available/taken/pending/active), page `/domains` dans la nav Dashboard, `/domain/success` avec polling + affichage DNS records, `/domain/cancel`
- ✅ Pensé swappable : `_mock_registrar_purchase` → remplaçable en 1h par Namecheap/Gandi/OpenProvider API call (contrat `{registrar_order_id, registration_date, expiry_date}`)
- ✅ **CTA dédié sur la Landing** (`#shop`) : "Commerçant ? Votre boutique ouverte 24/7" avec preview mock 4 produits + carte commande flottante, bouton principal → `/signup?intent=shop`, bouton secondaire → démo publique
- ✅ **Lien Boutique** dans la nav principale
- ✅ **Signup `?intent=shop`** : redirige après register vers `/onboarding-shop` au lieu de `/onboarding` ; panneau droit adapté avec features boutique
- ✅ **Page `/onboarding-shop`** : upsell Pro (Crown + features + CTA billing) pour free users / formulaire de création pour pro users → redirection vers /shop-builder/{id} après create
- ✅ **Public shop upgradé** : hero sombre avec preview 4 produits, chips de catégories filtrables, badges remise (-X%) + stock bas ("Plus que N en stock") + overlay rupture de stock

## Tests
- **iter 1 (MVP)**: 28/28 ✅
- **iter 2 (P0+P1+P2)**: 18/19 PASS (1 XFAIL = bug confirmé)
- **iter 3 (bug fixes)**: 8/8 PASS pour fixes ciblés ; phase2 14/14 ; iter1 26/27 (1 test coupling avec free tier limit, à fixer plus tard)
- **iter 4 (theme + section reorder)**: 5/5 backend PASS + Playwright E2E OK (presets, fonts, DnD, save, persistance, rendu public)
- **iter 5 (e-commerce complet)**: 29/29 backend PASS (Shops CRUD, isolation multi-tenant, Products + variantes + images, Checkout Stripe, Orders, webhook dispatch, TVA 20% inclusive) + Playwright E2E OK (catalogue → produit → variantes → panier → checkout → Stripe redirect)
- **iter 6 (Shopify-light + Landing CTA)**: 7/7 frontend PASS (Landing CTA #shop, Signup ?intent=shop, /onboarding-shop free+pro flows, category chips, badges remise/stock, régression cart→checkout)
- **iter 7 (Domain Marketplace MVP)**: 16/16 backend PASS + Playwright E2E OK (search + 12 suggestions + pricing + Stripe checkout redirection + auto-activation + DNS records + SSL + attach projet + listing + /domain/success polling + /domain/cancel)
- **iter 8 (Analytics + Renewal + Reminders)**: 11/11 backend PASS + frontend E2E OK. Bug trouvé par testing agent sur l'ordre d'itération des windows de reminder (corrigé: tightest→broadest, pas d'escalade)

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
