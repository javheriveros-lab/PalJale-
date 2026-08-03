import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime
from database import get_db
from auth_utils import require_provider, UserContext
from models import ConnectAccountRequest, ConnectAccountResponse, ConnectStatusResponse
from payments import check_kill_switch

router = APIRouter(prefix="/api/connect", tags=["Stripe Connect"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_emergent")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://paljale.mx")

@router.post("/account", response_model=ConnectAccountResponse)
async def create_connect_account(payload: ConnectAccountRequest, user: UserContext = Depends(require_provider)):
    db = await get_db()
    await check_kill_switch(db)
    existing = await db.users.find_one({"id": user.id})
    if existing and existing.get("stripe_connect_account_id"):
        account_id = existing["stripe_connect_account_id"]
    else:
        account = stripe.Account.create(type="express", country=payload.country, business_type=payload.business_type, capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}}, metadata={"paljale_user_id": user.id, "email": user.email})
        account_id = account.id
        await db.users.update_one({"id": user.id}, {"$set": {"stripe_connect_account_id": account_id, "stripe_connect_status": "pending", "stripe_connect_charges_enabled": False, "stripe_connect_payouts_enabled": False, "updated_at": datetime.utcnow()}})
    link = stripe.AccountLink.create(account=account_id, refresh_url=f"{FRONTEND_URL}/provider/connect?refresh=1", return_url=f"{FRONTEND_URL}/provider/connect?success=1", type="account_onboarding")
    return {"stripe_account_id": account_id, "account_link_url": link.url}

@router.get("/status", response_model=ConnectStatusResponse)
async def get_connect_status(user: UserContext = Depends(require_provider)):
    db = await get_db()
    await check_kill_switch(db)
    doc = await db.users.find_one({"id": user.id})
    if not doc or not doc.get("stripe_connect_account_id"):
        return ConnectStatusResponse(stripe_account_id=None, status=None, charges_enabled=False, payouts_enabled=False, requirements_due=True)
    account_id = doc["stripe_connect_account_id"]
    try:
        account = stripe.Account.retrieve(account_id)
        charges_enabled = account.charges_enabled
        payouts_enabled = account.payouts_enabled
        requirements_due = bool(account.requirements.currently_due)
        status = "active" if charges_enabled and payouts_enabled else "restricted"
        await db.users.update_one({"id": user.id}, {"$set": {"stripe_connect_status": status, "stripe_connect_charges_enabled": charges_enabled, "stripe_connect_payouts_enabled": payouts_enabled, "updated_at": datetime.utcnow()}})
        return ConnectStatusResponse(stripe_account_id=account_id, status=status, charges_enabled=charges_enabled, payouts_enabled=payouts_enabled, requirements_due=requirements_due)
    except stripe.error.StripeError:
        raise HTTPException(status_code=400, detail="No se pudo consultar el estado de la cuenta Stripe")

@router.post("/webhook")
async def connect_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    secret = os.getenv("STRIPE_CONNECT_WEBHOOK_SECRET", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except Exception:
        event = {}
    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})
    if event_type == "account.updated":
        account_id = data.get("id")
        db = await get_db()
        await db.users.update_one({"stripe_connect_account_id": account_id}, {"$set": {"stripe_connect_charges_enabled": data.get("charges_enabled", False), "stripe_connect_payouts_enabled": data.get("payouts_enabled", False), "stripe_connect_status": "active" if data.get("charges_enabled") and data.get("payouts_enabled") else "restricted", "updated_at": datetime.utcnow()}})
    return {"status": "received"}


@router.get("/requirements")
async def get_connect_requirements(user: UserContext = Depends(require_provider)):
    db = await get_db()
    await check_kill_switch(db)
    doc = await db.users.find_one({"id": user.id})
    account_id = doc.get("stripe_connect_account_id") if doc else None
    if not account_id:
        raise HTTPException(status_code=400, detail="No tienes una cuenta de Stripe Connect")
    try:
        account = stripe.Account.retrieve(account_id)
        requirements = account.requirements
        return {
            "currently_due": list(requirements.currently_due or []),
            "eventually_due": list(requirements.eventually_due or []),
            "past_due": list(requirements.past_due or []),
            "disabled_reason": requirements.disabled_reason,
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/account-link")
async def create_connect_account_link(payload: dict, user: UserContext = Depends(require_provider)):
    db = await get_db()
    await check_kill_switch(db)
    account_id = payload.get("stripe_account_id")
    if not account_id:
        doc = await db.users.find_one({"id": user.id})
        account_id = doc.get("stripe_connect_account_id") if doc else None
    if not account_id:
        raise HTTPException(status_code=400, detail="No tienes una cuenta de Stripe Connect")
    try:
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=f"{FRONTEND_URL}/provider/connect?refresh=1",
            return_url=f"{FRONTEND_URL}/provider/connect?success=1",
            type="account_onboarding",
        )
        return {"stripe_account_id": account_id, "account_link_url": link.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/payout-preview")
async def preview_payout(payload: dict, user: UserContext = Depends(require_provider)):
    db = await get_db()
    await check_kill_switch(db)
    amount_mxn = float(payload.get("amount_mxn", 0))
    is_international_card = bool(payload.get("is_international_card", False))
    if amount_mxn <= 0:
        raise HTTPException(status_code=400, detail="Monto inválido")

    platform_fee_percent = 5.0
    platform_fee_mxn = round(amount_mxn * platform_fee_percent / 100, 2)
    platform_fee_iva_mxn = round(platform_fee_mxn * 0.16, 2)

    stripe_fee_percent = 3.9 if is_international_card else 2.9
    stripe_fee_fixed_mxn = 3.0
    stripe_fee_mxn = round(amount_mxn * stripe_fee_percent / 100 + stripe_fee_fixed_mxn, 2)
    stripe_fee_iva_mxn = round(stripe_fee_mxn * 0.16, 2)

    stripe_total_cost_mxn = round(platform_fee_mxn + platform_fee_iva_mxn + stripe_fee_mxn + stripe_fee_iva_mxn, 2)
    provider_net_mxn = round(amount_mxn - stripe_total_cost_mxn, 2)
    provider_net_percent = round(provider_net_mxn / amount_mxn * 100, 2) if amount_mxn else 0.0

    return {
        "subtotal_mxn": amount_mxn,
        "platform_fee_percent": platform_fee_percent,
        "platform_fee_mxn": platform_fee_mxn,
        "platform_fee_iva_mxn": platform_fee_iva_mxn,
        "stripe_fee_percent": stripe_fee_percent,
        "stripe_fee_fixed_mxn": stripe_fee_fixed_mxn,
        "stripe_fee_mxn": stripe_fee_mxn,
        "stripe_fee_iva_mxn": stripe_fee_iva_mxn,
        "stripe_total_cost_mxn": stripe_total_cost_mxn,
        "is_international_card": is_international_card,
        "provider_net_mxn": provider_net_mxn,
        "provider_net_percent": provider_net_percent,
    }
