import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from datetime import datetime
from database import get_db
from auth_utils import require_provider, UserContext
from models import ConnectAccountRequest, ConnectAccountResponse, ConnectStatusResponse

router = APIRouter(prefix="/api/connect", tags=["Stripe Connect"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_emergent")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://paljale.mx")

@router.post("/account", response_model=ConnectAccountResponse)
async def create_connect_account(payload: ConnectAccountRequest, user: UserContext = Depends(require_provider)):
    db = await get_db()
    existing = await db.users.find_one({"id": user.id})
    now_iso = datetime.utcnow().isoformat()
    if existing and existing.get("stripe_connect_account_id"):
        account_id = existing["stripe_connect_account_id"]
    else:
        account = stripe.Account.create(
            type="express",
            country=payload.country,
            business_type=payload.business_type,
            capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
            metadata={"paljale_user_id": user.id, "email": user.email}
        )
        account_id = account.id
        await db.users.update_one(
            {"id": user.id},
            {"$set": {
                "stripe_connect_account_id": account_id,
                "stripe_connect_status": "pending",
                "stripe_connect_charges_enabled": False,
                "stripe_connect_payouts_enabled": False,
                "updated_at": now_iso
            }}
        )
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=f"{FRONTEND_URL}/provider/connect?refresh=1",
        return_url=f"{FRONTEND_URL}/provider/connect?success=1",
        type="account_onboarding"
    )
    return {"stripe_account_id": account_id, "account_link_url": link.url}

@router.post("/account-link")
async def refresh_connect_account_link(payload: dict = None, user: UserContext = Depends(require_provider)):
    db = await get_db()
    account_id = (payload.get("stripe_account_id") if payload else None)
    if not account_id:
        doc = await db.users.find_one({"id": user.id})
        account_id = doc.get("stripe_connect_account_id") if doc else None
    if not account_id:
        raise HTTPException(status_code=400, detail="Cuenta de Stripe Connect no encontrada")
    try:
        link = stripe.AccountLink.create(
            account=account_id,
            refresh_url=f"{FRONTEND_URL}/provider/connect?refresh=1",
            return_url=f"{FRONTEND_URL}/provider/connect?success=1",
            type="account_onboarding"
        )
        return {"stripe_account_id": account_id, "account_link_url": link.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/status", response_model=ConnectStatusResponse)
async def get_connect_status(user: UserContext = Depends(require_provider)):
    db = await get_db()
    doc = await db.users.find_one({"id": user.id})
    if not doc or not doc.get("stripe_connect_account_id"):
        return ConnectStatusResponse(stripe_account_id=None, status=None, charges_enabled=False, payouts_enabled=False, requirements_due=True)
    account_id = doc["stripe_connect_account_id"]
    try:
        account = stripe.Account.retrieve(account_id)
        charges_enabled = account.charges_enabled
        payouts_enabled = account.payouts_enabled
        requirements_due = bool(account.requirements.currently_due) if hasattr(account, "requirements") and hasattr(account.requirements, "currently_due") else False
        status = "active" if charges_enabled and payouts_enabled else "restricted"
        await db.users.update_one(
            {"id": user.id},
            {"$set": {
                "stripe_connect_status": status,
                "stripe_connect_charges_enabled": charges_enabled,
                "stripe_connect_payouts_enabled": payouts_enabled,
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        return ConnectStatusResponse(stripe_account_id=account_id, status=status, charges_enabled=charges_enabled, payouts_enabled=payouts_enabled, requirements_due=requirements_due)
    except stripe.error.StripeError:
        raise HTTPException(status_code=400, detail="No se pudo consultar el estado de la cuenta Stripe")

@router.get("/requirements")
async def get_connect_requirements(user: UserContext = Depends(require_provider)):
    db = await get_db()
    doc = await db.users.find_one({"id": user.id})
    if not doc or not doc.get("stripe_connect_account_id"):
        raise HTTPException(status_code=400, detail="No tienes una cuenta de Stripe Connect vinculada")
    account_id = doc["stripe_connect_account_id"]
    try:
        account = stripe.Account.retrieve(account_id)
        reqs = getattr(account, "requirements", None)
        return {
            "currently_due": list(getattr(reqs, "currently_due", []) or []),
            "eventually_due": list(getattr(reqs, "eventually_due", []) or []),
            "past_due": list(getattr(reqs, "past_due", []) or []),
            "disabled_reason": getattr(reqs, "disabled_reason", None)
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/payout-preview")
async def preview_payout(payload: dict, user: UserContext = Depends(require_provider)):
    try:
        amount_mxn = float(payload.get("amount_mxn", 0.0))
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Monto numérico inválido")
    if amount_mxn <= 0:
        raise HTTPException(status_code=400, detail="Monto debe ser mayor a 0")
    is_intl = bool(payload.get("is_international_card", False))

    plat_fee_pct = 5.0
    plat_fee_base = round(amount_mxn * (plat_fee_pct / 100.0), 2)
    plat_fee_iva = round(plat_fee_base * 0.16, 2)

    stripe_pct = 5.1 if is_intl else 3.6
    stripe_fixed = 3.0
    stripe_base = round(amount_mxn * (stripe_pct / 100.0) + stripe_fixed, 2)
    stripe_iva = round(stripe_base * 0.16, 2)
    stripe_total = round(stripe_base + stripe_iva, 2)

    provider_net = round(amount_mxn - plat_fee_base, 2)
    provider_net_pct = round((provider_net / amount_mxn) * 100.0, 1)

    return {
        "subtotal_mxn": amount_mxn,
        "platform_fee_percent": plat_fee_pct,
        "platform_fee_mxn": plat_fee_base,
        "platform_fee_iva_mxn": plat_fee_iva,
        "stripe_fee_percent": stripe_pct,
        "stripe_fee_fixed_mxn": stripe_fixed,
        "stripe_fee_mxn": stripe_base,
        "stripe_fee_iva_mxn": stripe_iva,
        "stripe_total_cost_mxn": stripe_total,
        "is_international_card": is_intl,
        "provider_net_mxn": provider_net,
        "provider_net_percent": provider_net_pct,
    }

@router.post("/webhook")
async def connect_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    secret = os.getenv("STRIPE_CONNECT_WEBHOOK_SECRET", "")
    if not secret:
        raise HTTPException(status_code=500, detail="STRIPE_CONNECT_WEBHOOK_SECRET no configurado")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event.get("type")
    data = event.get("data", {}).get("object", {})
    if event_type == "account.updated":
        account_id = data.get("id")
        db = await get_db()
        charges = data.get("charges_enabled", False)
        payouts = data.get("payouts_enabled", False)
        await db.users.update_one(
            {"stripe_connect_account_id": account_id},
            {"$set": {
                "stripe_connect_charges_enabled": charges,
                "stripe_connect_payouts_enabled": payouts,
                "stripe_connect_status": "active" if charges and payouts else "restricted",
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
    return {"status": "received"}

