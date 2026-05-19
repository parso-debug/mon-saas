---
name: artisanweb-backend
description: Expert FastAPI, Motor MongoDB, JWT, Stripe webhooks et architecture multi-tenant SaaS. Use when you need to design, debug, extend, or review the ArtisanWeb backend in server.py, API routes, authentication, database access, or payment webhooks.
---

# ArtisanWeb Backend

## Instructions

### Step 1: Comprendre le contexte backend
- Travailler en priorité sur le backend FastAPI de ArtisanWeb.
- Lire les routes, modèles, services, et toute logique liée à `server.py` avant de modifier quoi que ce soit.
- Respecter l’architecture existante et éviter de casser les routes ou contrats déjà en place.

### Step 2: Appliquer les règles métier du projet
- Utiliser Motor pour MongoDB, jamais de driver synchrone.
- Valider les données d’entrée avec Pydantic v2.
- Protéger les routes privées avec JWT et `Depends(current_user)`.
- Garder la logique Stripe côté backend, avec le webhook comme source de vérité.
- Respecter le multi-tenant SaaS et les règles d’isolation des données utilisateur.

### Step 3: Produire des changements sûrs et compatibles
- Préférer des modifications minimales et ciblées.
- Éviter la duplication de logique.
- Garder les formats de réponse cohérents avec l’existant.
- Si une nouvelle route ou un nouveau service est ajouté, vérifier qu’il est bien relié au système existant.

### Step 4: Vérifier la qualité
- Contrôler les erreurs, les cas limites et les réponses d’échec.
- S’assurer que les timestamps et données sensibles suivent les conventions du projet.
- Vérifier que le code reste compatible avec l’architecture monolithique du backend.
- Préférer des sorties JSON structurées et déterministes pour les flux IA ou automatisés.

### Step 5: Livrer une solution exploitable
- Documenter clairement les changements techniques.
- Indiquer les fichiers impactés et les impacts sur l’API.
- Si nécessaire, proposer les commandes de test adaptées au backend FastAPI.
