MongoDB collections:
- users: email, password_hash, is_admin, is_pro, is_active, created_at
- sites: user_id, slug, title, domain, published, content, theme, views
- shops, orders, leads, reviews, domains, payments, app_settings

AI features:
- Retourner JSON structuré toujours
- Gérer erreurs gracieusement
- Prompts réutilisables
- Outputs déterministes
- Timestamps UTC: datetime.now(timezone.utc)