---
name: artisanweb-frontend
description: Expert frontend React 18 + CRACO + Tailwind + shadcn/ui pour ArtisanWeb : diagnostic UI, génération de pages SaaS, traduction maquettes en composants réutilisables, audit responsive mobile-first, et intégration API avec gestion d'états.
---

# artisanweb-frontend

## Objectif
Aider à modifier et étendre le frontend ArtisanWeb (React 18 + CRACO) en :
- diagnostiquant une page (UI/UX) et proposant des composants shadcn/ui équivalents,
- générant de nouvelles pages SaaS (ex: Dashboard, Pricing, Builder) en respectant l’architecture existante,
- traduisant des maquettes/screenhots en composants React (Tailwind + shadcn/ui),
- refactorant des composants existants vers shadcn/ui,
- auditant le responsive mobile-first et corrigeant via Tailwind,
- intégrant des appels API côté frontend avec gestion loading/error via toasts.

## Périmètre (NE PAS faire)
- Ne jamais toucher à : `backend/`, `.env`, logique auth (`frontend/src/lib/auth*` si présent), routes API.
- Ne pas modifier le comportement Stripe/checkout côté backend.
- Ne pas ajouter de dépendances npm sans validation explicite.
- Ne pas créer de logique métier backend.

## Entrées utilisateur requises
L’utilisateur doit fournir (au minimum) :
1. **Chemin du fichier à modifier** (ou préciser “nouveau fichier” avec chemin cible), ex. `frontend/src/pages/Pricing.jsx`
2. **Route concernée**, ex. `/pricing`
3. **Screenshot ou description** de la maquette/UI
4. **Contexte** : composant parent, props disponibles, état auth (si la page est privée/public)
5. **Contraintes spécifiques** éventuelles, ex. “garder le même state management”

## Format de sortie (toujours dans cet ordre)
1. **Checklist des étapes** : analyse → plan → code → responsive/accessibilité → instructions de test
2. **Liste des fichiers** à créer/modifier avec chemins complets
3. **Patch diff ou code complet** (selon le cas) du composant/page cible
4. **Notes responsive & accessibilité** (mobile-first, paliers <640px / 768px / 1024px)
5. **Commande de test** + URL à vérifier

## Règles de style et contraintes absolues
- **UI en français uniquement** (textes dans le rendu).
- **Code et commentaires en anglais**.
- Obligation **shadcn/ui** :
  - utiliser en priorité les composants existants dans `frontend/src/components/ui/`,
  - créer seulement si aucun composant existant n’est adapté,
  - ne pas ré-implémenter un composant shadcn/ui.
- **Tailwind uniquement** :
  - aucun CSS custom,
  - aucun `styled-components`,
  - pas de CSS inline,
  - utiliser des classes Tailwind pour le responsive.
- **Mobile-first obligatoire** : commencer les styles pour `<640px`.
- **Typescript strict** côté projet : pas de `any`, pas de `unknown`, pas de `@ts-ignore`.
- **Gestion des états API systématique** :
  - loader,
  - erreurs gérées,
  - toasts (sonner) pour succès/erreur,
  - récupération du token JWT via les mécanismes existants (lib axios/fetch de l’existant).
- **Preserve l’architecture CRACO** (ne pas proposer Next/Vite migration).
- **Réutiliser les composants existants** avant d’en créer de nouveaux (pages communes, layout, sections, etc.).

## Procédure recommandée (interne à la skill)
1. **Analyse** :
   - parcourir le fichier cible et ses dépendances directes,
   - repérer les composants déjà utilisés (layout, navbar, Card, Button, Dialog…),
   - identifier les incohérences UX et les manques de responsive.
2. **Plan** :
   - associer les éléments de la maquette aux composants shadcn/ui existants,
   - décider où injecter états loading/error et comment structurer le state.
3. **Code** :
   - générer le patch ou le fichier complet,
   - s’assurer que la page est mobile-first et accessible,
   - appliquer la FR dans tous les textes visibles.
4. **Responsive & accessibilité** :
   - vérifier <640px / 768px / 1024px,
   - focus states, labels, contrastes, structure sémantique.
5. **Test** :
   - fournir `yarn start` et l’URL (route) à vérifier.

## Exemple d’appel de l’utilisateur
- “Modifie `frontend/src/pages/Pricing.jsx` pour la route `/pricing`. Voici une capture et la description… Le user est authentifié/pro… Garde le state management actuel. Utilise shadcn/ui et Tailwind uniquement.”

## Critères d’acceptation
- La page respecte shadcn/ui (pas de composants UI maison si un équivalent existe).
- Pas de CSS custom ; responsive mobile-first OK.
- Intégration API avec loading/error/toasts.
- Les textes affichés sont en français ; le code reste en anglais.
