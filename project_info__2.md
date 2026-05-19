Je suis en **Explore Mode** : je peux te donner le **format exact** et la procédure pour créer ta skill manuellement, mais je ne peux pas écrire sur ton disque depuis ici.

## Checklist (pas à pas)
- [ ] Choisir le nom de la skill (nom du dossier) : `<skill-name>`
- [ ] Construire le chemin de base selon OS  
  - [ ] **Windows** : `%USERPROFILE%\.claude\skills\<skill-name>\`  
  - [ ] **macOS/Linux** : `$HOME/.claude/skills/<skill-name>/` (ou `~/.claude/skills/<skill-name>/`)
- [ ] Créer le dossier `<skill-name>/`
- [ ] Créer le fichier `SKILL.md` à la racine du dossier
- [ ] Mettre le **YAML frontmatter** tout en haut du fichier avec `name` et `description`
- [ ] Ajouter les instructions Markdown (rôle, étapes, entrées/sorties, contraintes)
- [ ] (Optionnel) Créer `scripts/`, `references/`, `assets/` et y déposer le contenu nécessaire
- [ ] (Optionnel) Tester dans Claude pour vérifier que la skill apparaît

## Structure de dossiers (recommandée)
```text
~/.claude/skills/<skill-name>/
├── SKILL.md
├── scripts/      # optionnel
├── references/   # optionnel
└── assets/       # optionnel
```

## Format obligatoire de `SKILL.md` (exemple prêt à copier-coller)
> Le **frontmatter YAML doit être le tout début du fichier**.

```markdown
---
name: "Nom lisible de la skill"
description: "Description courte : ce que la skill fait + quand l’utiliser."
---

# Instructions

## Objectif
Décris ici le but de la skill.

## Entrées attendues
- Liste ce que l’utilisateur doit fournir (ou ce que la skill doit demander).
- Précise les formats attendus.

## Étapes
1. Étape 1 : ...
2. Étape 2 : ...
3. Étape 3 : ...

## Sortie
Décris le format de sortie attendu (ex : checklist, étapes numérotées, JSON, etc.).

## Règles / Contraintes
- Règle 1 : ...
- Règle 2 : ...
```

## Pour que je te le génère “sur mesure”
Dis-moi :
1) le **nom** exact de la skill (pour `<skill-name>`)  
2) sa **mission** en 1-2 phrases  
3) le **format de sortie** que tu veux (texte structuré, checklist, JSON, etc.)

task_progress: 0/8 (j’ai fourni le plan + le template; il ne manque que l’adaptation au contenu de ta skill).