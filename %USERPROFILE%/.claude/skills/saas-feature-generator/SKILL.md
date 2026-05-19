---
name: saas-feature-generator
description: Génère, à partir d’une description texte d’une feature, un plan d’implémentation détaillé + du squelette de code FastAPI, React, MongoDB et tests, en respectant l’architecture mon-saas (backend privé avec JWT, MongoDB via Motor async, frontend avec React Router + shadcn/ui, et Stripe via backend).
---

# SAAS Feature Generator

## Instructions

### Step 1: Comprendre la feature demandée
1. Reformule la demande utilisateur en 2-5 phrases.
2. Liste les **entités** impactées (ex: user, credit, referral, subscription, billing, domain, etc.).
3. Identifie les **droits d’accès** (routes privées JWT vs publiques).
4. Identifie les **flux** (ex: création → validation → paiement → mise à jour DB).
5. Si des informations manquent, pose des questions ciblées (max 3). Sinon, fais des hypothèses raisonnables et explicite-les.

### Step 2: Définir le contrat d’API (backend FastAPI)
1. Propose les endpoints FastAPI nécessaires (méthode + route).
2. Pour chaque endpoint, précise :
   - entrée (request body / params / query),
   - sortie (response shape),
   - codes d’erreur probables,
   - exigences auth (JWT, rôles si applicable).
3. Aligne la structure sur l’architecture mon-saas :
   - Validation avec Pydantic v2
   - MongoDB via Motor async
   - Utiliser les patterns existants de `backend/server.py` et/ou `/services` (selon ce qui existe déjà)
   - Toutes les routes privées protégées par JWT HS256

### Step 3: Définir le modèle MongoDB (Motor async)
1. Décris les collections / schémas MongoDB nécessaires.
2. Indique les champs, indexes conseillés, et relations (si références).
3. Propose une migration/patch si le schéma doit évoluer :
   - script de migration (ou étape de “backfill”)
   - stratégie de compatibilité (si données existantes)

### Step 4: Définir la logique Stripe (si la feature implique paiement)
1. Détermine s’il faut :
   - création checkout/session côté backend,
   - webhook Stripe,
   - mise à jour du statut subscription/credits,
   - gestion des échecs et idempotence.
2. Donne la liste des événements webhook à traiter et les règles d’écriture DB associées.
3. Rappelle que les clés Stripe restent côté backend.

### Step 5: Définir le contrat frontend (React + shadcn/ui)
1. Propose une page React (ou intégration dans une page existante) avec :
   - composants UI (shadcn/ui)
   - hook custom
   - actions utilisateur (form submit, boutons)
2. Décris l’état local (loading, success, error) et le comportement UX.
3. Définis les appels HTTP via Axios (en supposant l’intercepteur JWT existant).

### Step 6: Définir les fichiers à créer (backend + frontend)
1. Backend (détailler les fichiers) :
   - route FastAPI (ex: `backend/routes/...`)
   - modèles Pydantic (ex: `backend/models/...` ou au pattern local)
   - tests Pytest (ex: `backend/tests/test_...py`)
   - services (si logique métier séparée) dans `backend/services/...`
   - migration MongoDB si nécessaire
2. Frontend :
   - page React
   - hook custom
   - composants UI si nécessaires
   - wiring (import, route React Router) si applicable

### Step 7: Produire un plan d’implémentation détaillé
Génère un plan en étapes actionnables :
1. Pré-requis et conventions à respecter
2. Modifs backend (fichiers + ordre)
3. Modifs MongoDB (schéma + migration)
4. Modifs frontend (fichiers + wiring)
5. Modifs auth/guards si nécessaire
6. Tests (quoi tester, cas nominal + erreurs)
7. Commandes à exécuter (format “commande + but”)

### Step 8: Générer (optionnel) des squelettes de code cohérents
Si l’utilisateur demande explicitement du code, génère uniquement :
- le squelette de fichiers (structure) **et** les parties critiques (validation, routes, appels frontend)
- et veille à utiliser les conventions déjà présentes dans mon-saas.
Sinon, donne uniquement le plan.

### Step 9: Gérer les cas limites et la sécurité
1. Ajoute une section “Sécurité & Validation” :
   - validation inputs (Zod côté front, Pydantic côté back)
   - contrôle d’accès JWT sur routes privées
   - protection contre incohérences DB (idempotence si Stripe)
2. Ajoute une section “Edge cases” (au moins 5).

## Output Format (attendu)
1. **Plan d’implémentation détaillé** (sections Step 1 → Step 7)
2. **Liste des fichiers backend** à créer/modifier
3. **Liste des fichiers frontend** à créer/modifier
4. **Tests** à ajouter (cas de test)
5. **Migration MongoDB** si applicable
6. **Commandes à exécuter** (ex: commandes de tests et de démarrage)

## Règles
- Toujours respecter l’architecture mon-saas fournie (FastAPI + Motor async + JWT + React Router + shadcn/ui).
- Ne jamais exposer de clés API côté frontend.
- Si des détails manquent, demander au maximum 3 questions, puis continuer avec hypothèses explicites.
- Ne pas créer d’outil supplémentaire : cette skill produit du plan + squelettes (ou code demandé), pas des scripts exécutables en dehors des commandes listées.
