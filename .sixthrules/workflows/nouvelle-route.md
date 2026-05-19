# Workflow: nouvelle-route

Paramètre: {nom_feature}

Objectif: Boilerplate complet pour une nouvelle feature FastAPI + React.

Steps:
1. Crée `/backend/services/{nom_feature}.py` avec route GET/POST/DELETE, Pydantic model, Motor async
2. Ajoute le router dans `/backend/server.py`
3. Crée `/backend/tests/test_{nom_feature}.py` avec 3 tests: create, read, auth
4. Crée `/frontend/src/hooks/use{nom_feature}.ts` avec axios + React Query
5. Crée `/frontend/src/pages/{nom_feature}.tsx` avec un composant Shadcn/ui basique
6. Retourne la liste des 5 fichiers créés + commande `pytest backend/tests/test_{nom_feature}.py`