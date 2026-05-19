STRIPE:
- Webhooks Stripe = sources de vérité :
    - /api/webhook/stripe (paiements one-shot)
    - /api/webhook/stripe/subscriptions (abonnements)
- Jamais updater is_pro côté frontend
- Source de vérité Pro = champ `pro_until` (datetime UTC) dans db.users
- Statut Pro = is_pro(user) → True si pro_until > now()
- Webhook appelle `_apply_pro_credit_if_paid(session_id)` qui écrit pro_until

- Metadata OBLIGATOIRES (utiliser `kind`, pas `type`) :
    - Pro : user_id, user_email, package_id, days, kind='pro'
    - Shop : user_id, kind='shop_order'
    - Domaine achat : user_id, kind='domain_purchase'
    - Domaine renewal : user_id, kind='domain_renewal'
    - Domaine auto-renew : user_id, kind='domain_auto_renew_subscription'

- Checkout uniquement via Stripe Checkout Sessions
- Ne jamais créer de customer Stripe côté frontend

SÉCURITÉ:
- Routes protégées: Depends(current_user)
- Admin: current_user.is_admin == True
- Routes publiques: préfixe /public/
- Secrets uniquement via os.environ
- Logs: logger.error() pour erreurs critiques