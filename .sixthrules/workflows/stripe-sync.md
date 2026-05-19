# Workflow: stripe-sync

Objectif: Vérifier que Stripe webhooks + DB sont synchro pour mon-saas.

Steps:
1. Lis `backend/server.py` lignes 1166-1191 (webhook principal)
2. Vérifie que `.env` contient `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET`
3. Lance en local: `stripe listen --forward-to localhost:8000/api/webhook/stripe`
4. Query MongoDB :
   - `db.payment_transactions.find({payment_status:"paid"}).sort({created_at:-1}).limit(5)`
   - `db.orders.find({payment_status:"initiated"}).limit(5)`
   - `db.domains.find({payment_status:"initiated"}).limit(5)`
5. Pour chaque session "initiated" > 5min, relance `_apply_pro_credit_if_paid(session_id)` ou équivalent
6. Si mismatch, génère un script Python qui appelle les fonctions `_apply_*_if_paid` pour resync