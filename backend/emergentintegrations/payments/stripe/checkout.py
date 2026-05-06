import asyncio
from typing import Dict, Optional

import stripe as stripe_sdk
from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    """Request model for creating a Stripe checkout session."""
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Optional[Dict[str, str]] = None


class CheckoutSessionResponse(BaseModel):
    """Response model returned after creating a Stripe checkout session."""
    session_id: str
    url: str


class CheckoutStatusResponse(BaseModel):
    """Response model for polling the status of a Stripe checkout session."""
    session_id: str
    payment_status: str  # e.g. "paid", "unpaid", "no_payment_required"
    status: str          # e.g. "open", "complete", "expired"
    amount_total: Optional[int] = None
    currency: Optional[str] = None


class StripeCheckout:
    """Thin async wrapper around the Stripe checkout SDK."""

    def __init__(self, api_key: str, webhook_url: str = ""):
        self.api_key = api_key
        self.webhook_url = webhook_url
        self._client = stripe_sdk.StripeClient(api_key)

    async def create_checkout_session(
        self, req: CheckoutSessionRequest
    ) -> CheckoutSessionResponse:
        """Create a Stripe checkout session and return its ID and redirect URL."""
        amount_cents = int(round(req.amount * 100))
        session = await asyncio.to_thread(
            self._client.checkout.sessions.create,
            params={
                "mode": "payment",
                "payment_method_types": ["card"],
                "line_items": [
                    {
                        "quantity": 1,
                        "price_data": {
                            "currency": req.currency.lower(),
                            "unit_amount": amount_cents,
                            "product_data": {"name": "Payment"},
                        },
                    }
                ],
                "success_url": req.success_url,
                "cancel_url": req.cancel_url,
                "metadata": req.metadata or {},
            },
        )
        return CheckoutSessionResponse(
            session_id=session.id,
            url=session.url,
        )

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        """Retrieve the current status of a Stripe checkout session."""
        session = await asyncio.to_thread(
            self._client.checkout.sessions.retrieve,
            session_id,
        )
        return CheckoutStatusResponse(
            session_id=session.id,
            payment_status=session.payment_status,
            status=session.status,
            amount_total=session.amount_total,
            currency=session.currency,
        )
