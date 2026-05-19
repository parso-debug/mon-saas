PROJET: ArtisanWeb - Website-as-a-Service pour artisans

BACKEND (source de vérité):
- FastAPI monolithe backend/server.py (~2800 lignes)
- Motor MongoDB async (db global)
- Auth JWT via Depends(current_user)
- Routes sur api_router, préfixe /api
- Port local: 8000
- Ne JAMAIS splitter server.py sans validation

FRONTEND:
- React 18 + CRACO (PAS Next.js)
- shadcn/ui + Tailwind uniquement
- Alias @/ = src/
- Appels API: axios/fetch avec REACT_APP_BACKEND_URL=http://localhost:8000
- Pages dans src/pages/, composants dans src/components/

INTERDIT:
- PostgreSQL/Supabase
- Duplication de logique Stripe
- CSS inline sauf exception
- Casser routes existantes