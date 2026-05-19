# SIXTH Workspace Rules - mon-saas

project:
  name: mon-saas
  type: fullstack-saas
  
stack:
  frontend:
    framework: React 19.0.0
    styling: TailwindCSS 3.4 + Radix UI + Shadcn/ui
    forms: React Hook Form + Zod
    routing: React Router DOM 7.5.1
    charts: Recharts
    http: Axios
    
  backend:
    framework: FastAPI 0.110.1
    server: Uvicorn
    database: MongoDB avec Motor async
    auth: JWT HS256 + Passlib + bcrypt
    
  integrations:
    ai: Google GenAI + OpenAI + LiteLLM
    payments: Stripe
    email: Resend
    storage: AWS S3 via boto3

coding_rules:
  language: TypeScript pour frontend, Python 3.11+ pour backend
  comments: En français uniquement
  typescript: Mode strict, aucun any autorisé
  python: Type hints obligatoires, Black + isort + Flake8
  
  backend_conventions:
        - Toujours utiliser Motor pour MongoDB, jamais de driver sync
        - Pydantic v2 pour validation
        - Routes dans server.py ou /services
        - Variables d'env via python-dotenv, jamais hardcodé
        - Auth JWT sur toutes les routes privées
    
  frontend_conventions:
        - Composants dans /src/components
        - Hooks custom dans /src/hooks
        - Utiliser Shadcn/ui en priorité avant de créer du custom
        - Zod pour valider tous les forms
        - Axios avec intercepteur pour le token JWT

architecture:
    - Ne jamais exposer les clés API côté frontend
    - Toutes les calls IA passent par le backend FastAPI
    - Stripe webhooks dans /backend/services/stripe_webhook.py
    - Upload S3 via backend uniquement