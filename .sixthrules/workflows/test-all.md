# Workflow: test-all

Objectif: Vérifier que backend + frontend sont clean avant de push.

Steps:
1. Lance `cd backend && pytest -v tests/` 
2. Si tests OK, lance `cd backend && black . && isort . && flake8 .`
3. Lance `cd frontend && npm run build`
4. Check qu'il n'y a aucun `console.log`, `print()`, ou `TODO` oublié dans le diff git
5. Résume : "X tests passés, code formatté, build OK" ou liste les erreurs à fix
