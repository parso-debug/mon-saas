---
name: diagnostic-technique
description: Fournit une méthode systématique pour diagnostiquer des bugs, erreurs, régressions et comportements inattendus. À utiliser quand il faut reproduire un problème, isoler sa cause racine, valider une hypothèse et vérifier un correctif.
---

# Diagnostic Technique

## Instructions

### Étape 1 : Cadrer le symptôme
- Reformuler le problème en une phrase claire.
- Identifier le contexte exact
  - environnement
  - version ou branche
  - entrée utilisateur
  - comportement attendu
  - comportement observé
- Repérer les changements récents susceptibles d’avoir introduit le problème.

### Étape 2 : Reproduire et capturer la preuve
- Chercher à reproduire le problème de façon fiable.
- Récupérer les messages d’erreur complets, logs, traces et captures utiles.
- Distinguer les symptômes des causes probables.
- Si le problème n’est pas reproductible, noter précisément les conditions manquantes.

### Étape 3 : Localiser la zone fautive
- Déterminer si le souci vient du frontend, backend, données, configuration, réseau, dépendances ou intégration.
- Lire en priorité les fichiers directement liés au chemin d’exécution touché.
- Comparer le comportement réel avec les contrats attendus
  - types
  - schémas
  - routes
  - props
  - variables d’environnement
  - entrées/sorties

### Étape 4 : Formuler une hypothèse testable
- Écrire une hypothèse courte et précise sur la cause racine.
- Ne corriger qu’un seul point à la fois.
- Vérifier l’hypothèse avec le changement le plus petit possible.
- Si l’hypothèse est fausse, revenir au symptôme et en tester une autre.

### Étape 5 : Corriger proprement
- Corriger la cause racine, pas seulement le symptôme.
- Préserver l’architecture existante.
- Éviter les contournements fragiles.
- Ajouter si nécessaire une validation, un garde-fou ou une extraction de logique commune.

### Étape 6 : Vérifier le correctif
- Reproduire le scénario initial.
- Exécuter la vérification appropriée
  - tests
  - build
  - type-check
  - requête API
  - navigation UI
- Confirmer qu’aucune régression évidente n’a été introduite.
- Si possible, ajouter un test de non-régression.

### Étape 7 : Résumer clairement
- Expliquer la cause racine en termes simples.
- Décrire le correctif appliqué.
- Mentionner les vérifications effectuées.
- Si le problème reste partiellement ouvert, indiquer exactement ce qui manque.

## Règles de travail
- Toujours lire le code ou les logs concernés avant de proposer une correction.
- Ne jamais masquer une erreur avec un `try/catch` vide ou un contournement opaque.
- Préférer une investigation structurée à des essais aléatoires.
- Si une information manque, demander uniquement ce qui bloque réellement l’analyse.
- Garder les changements petits, ciblés et vérifiables.

## Modèle de diagnostic
1. Symptôme observé
2. Reproduction
3. Zone suspecte
4. Hypothèse
5. Correction
6. Vérification
7. Résultat final
