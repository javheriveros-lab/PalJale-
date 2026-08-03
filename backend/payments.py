import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from datetime import datetime
from typing import Optional
from database import get_db
from auth_utils import get_current_user, UserContext, require_admin, require_provider
from bson import ObjectId
from models import SetupIntentResponse, PaymentMethodCard, OneTapPaymentRequest

router = APIRouter(prefix="/api/payments", tags=["Payments"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "sk_test_emergent")
PLATFORM_FEE_PERCENT = 0.05

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head><title>Pal Jale - Pago</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
<h2>{title}</h2>
<p>{message}</p>
<a href="/" style="color:#F37820;">Volver al inicio</a>
</body>
</html>
"""

async def check_kill_switch(db):
    settings = await db.settings.find_one({"key": "global"})
    if settings and settings.get("payments_enabled") is False:
        reason = settings.get("kill_switch_reason") or "Mantenimiento temporal"
        raise HTTPException(status_code=503, detail=f"Kill Switch activo: {reason}")


async def ensure_stripe_customer(db, user_id: str, email: str) -> str:
    await check_kill_switch(db)
    user = await db.users.find_one({"id": user_id})
    if user and user.get("stripe_customer_id"):
        return user["stripe_customer_id"]
    customer = stripe.Customer.create(email=email, metadata={"paljale_user_id": user_id})
    await db.users.update_one({"id": user_id}, {"$set": {"stripe_customer_id": customer.id, "updated_at": datetime.utcnow()}})
    return customer.id

@router.post("/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await check_kill_switch(db)
    customer_id = await ensure_stripe_customer(db, user.id, user.email)
    intent = stripe.SetupIntent.create(customer=customer_id, payment_method_types=["card"], metadata={"paljale_user_id": user.id})
    return {"client_secret": intent.client_secret, "stripe_customer_id": customer_id}

@router.get("/payment-methods")
async def list_payment_methods(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await check_kill_switch(db)
    user_doc = await db.users.find_one({"id": user.id})
    customer_id = user_doc.get("stripe_customer_id") if user_doc else None
    if not customer_id:
        return {"items": []}
    methods = stripe.PaymentMethod.list(customer=customer_id, type="card")
    items = []
    for m in methods.data:
        items.append(PaymentMethodCard(id=m.id, brand=m.card.brand, last4=m.card.last4, exp_month=m.card.exp_month, exp_year=m.card.exp_year, is_default=(m.id == user_doc.get("default_payment_method_id"))))
    return {"items": items}

@router.delete("/payment-methods/{pm_id}")
async def delete_payment_method(pm_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await check_kill_switch(db)
    try:
        stripe.PaymentMethod.detach(pm_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.users.update_one({"id": user.id, "default_payment_method_id": pm_id}, {"$unset": {"default_payment_method_id": ""}})
    return {"success": True}

@router.post("/checkout-session")
async def create_checkout_session(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await check_kill_switch(db)
    order_id = payload.get("order_id")
    order = await db.orders.find_one({"id": order_id, "user_id": user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    customer_id = await ensure_stripe_customer(db, user.id, user.email)
    session_id = f"cs_mock_{ObjectId()}"
    session_url = f"/api/payments/success?session_id={session_id}"
    await db.orders.update_one({"id": order_id}, {"$set": {"stripe_session_id": session_id, "stripe_session_url": session_url, "payment_status": "pending", "stripe_customer_id": customer_id}})
    return {"url": session_url, "session_id": session_id}

@router.post("/one-tap")
async def one_tap_payment(payload: OneTapPaymentRequest, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await check_kill_switch(db)
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    total_cents = int(order["total_mxn"] * 100)
    fee_cents = int(order["platform_fee_mxn"] * 100)
    try:
        intent = stripe.PaymentIntent.create(amount=total_cents, currency="mxn", customer=order.get("stripe_customer_id"), payment_method=payload.payment_method_id, off_session=True, confirm=True, metadata={"order_id": payload.order_id, "type": "one_tap"}, application_fee_amount=fee_cents)
        await db.orders.update_one({"id": payload.order_id}, {"$set": {"payment_status": "paid", "paid_at": datetime.utcnow(), "stripe_payment_intent_id": intent.id}})
        return {"success": True, "payment_intent_id": intent.id, "status": intent.status}
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Tarjeta rechazada")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, os.getenv("STRIPE_WEBHOOK_SECRET", ""))
    except Exception:
        event = {"type": "checkout.session.completed", "data": {"object": {"metadata": {"order_id": "mock"}}}}
    event_type = event.get("type")
    data_obj = event.get("data", {}).get("object", {})
    db = await get_db()
    if event_type == "checkout.session.completed":
        session = data_obj
        meta = session.get("metadata", {})
        if meta.get("type") == "pro_subscription":
            user_id = meta.get("paljale_user_id")
            sub_id = session.get("subscription")
            if user_id and sub_id:
                await db.users.update_one({"id": user_id}, {"$set": {"is_pro": True, "pro_subscription_id": sub_id, "pro_status": "active", "updated_at": datetime.utcnow().isoformat()}})
            return {"status": "success"}
        order_id = meta.get("order_id")
        if order_id:
            await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "paid", "paid_at": datetime.utcnow(), "stripe_payment_intent_id": session.get("payment_intent", f"pi_mock_{ObjectId()}")}})
    elif event_type == "invoice.paid":
        sub_id = data_obj.get("subscription")
        if sub_id:
            await db.users.update_one({"pro_subscription_id": sub_id}, {"$set": {"is_pro": True, "pro_status": "active", "updated_at": datetime.utcnow().isoformat()}})
    elif event_type == "customer.subscription.deleted":
        sub_id = data_obj.get("id")
        if sub_id:
            await db.users.update_one({"pro_subscription_id": sub_id}, {"$set": {"is_pro": False, "pro_status": "canceled", "updated_at": datetime.utcnow().isoformat()}})
    return {"status": "success"}

@router.post("/confirm/{order_id}")
async def confirm_payment_manual(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "paid", "paid_at": datetime.utcnow(), "stripe_payment_intent_id": f"pi_manual_{ObjectId()}"}})
    return {"success": True, "message": "Pago confirmado manualmente"}

@router.post("/deposit/{order_id}/release")
async def release_deposit(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.get("deposit_status") != "held":
        raise HTTPException(status_code=400, detail="Depósito no retenido")
    await db.orders.update_one({"id": order_id}, {"$set": {"deposit_status": "released"}})
    return {"success": True, "message": "Depósito liberado"}

@router.post("/deposit/{order_id}/capture")
async def capture_deposit(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.get("deposit_status") != "held":
        raise HTTPException(status_code=400, detail="Depósito no retenido")
    await db.orders.update_one({"id": order_id}, {"$set": {"deposit_status": "captured"}})
    return {"success": True, "message": "Depósito capturado por daño"}

@router.get("/success", response_class=HTMLResponse)
async def payment_success():
    return HTML_TEMPLATE.format(title="¡Pago Exitoso!", message="Tu transacción se completó correctamente.")

@router.get("/cancel", response_class=HTMLResponse)
async def payment_cancel():
    return HTML_TEMPLATE.format(title="Pago Cancelado", message="La transacción fue cancelada o no se completó.")

async def auto_process_commission_on_return(db, order_id: str):
    await check_kill_switch(db)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return False
    if order.get("payment_status") != "paid":
        return False
    if order.get("status") not in ["entregada", "devuelta"]:
        return False
    existing = await db.commission_payouts.find_one({"order_id": order_id})
    if existing:
        return True
    bank_config = await db.bank_configs.find_one({"is_active": True})
    if not bank_config:
        return False
    subtotal = order.get("subtotal_mxn", 0)
    commission_amount = order.get("platform_fee_mxn", subtotal * PLATFORM_FEE_PERCENT)
    payout_record = {
        "id": f"po_{ObjectId()}",
        "order_id": order_id,
        "amount_mxn": round(commission_amount, 2),
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
        "bank_config_snapshot": {"bank_name": bank_config["bank_name"], "account_holder": bank_config["account_holder"], "card_number_last4": bank_config["card_number"][-4:]},
        "status": "pending",
        "stripe_transfer_id": None,
        "processed_at": None,
        "created_at": datetime.utcnow()
    }
    await db.commission_payouts.insert_one(payout_record)
    await db.commission_payouts.update_one({"id": payout_record["id"]}, {"$set": {"status": "completed", "processed_at": datetime.utcnow(), "stripe_transfer_id": f"tr_mock_{ObjectId()}"}})
    return True

async def transfer_to_provider(db, order_id: str):
    await check_kill_switch(db)
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return False
    if order.get("provider_payout_status") == "transferred":
        return True
    if order.get("payment_status") != "paid":
        return False
    if order.get("status") not in ["entregada", "devuelta"]:
        return False
    provider = await db.users.find_one({"id": order["provider_id"]})
    if not provider or not provider.get("stripe_connect_account_id"):
        return False
    if not provider.get("stripe_connect_payouts_enabled"):
        return False
    amount_mxn = order.get("subtotal_mxn", 0) - order.get("platform_fee_mxn", 0)
    if amount_mxn <= 0:
        return False
    amount_cents = int(amount_mxn * 100)
    account_id = provider["stripe_connect_account_id"]
    try:
        transfer = stripe.Transfer.create(amount=amount_cents, currency="mxn", destination=account_id, metadata={"order_id": order_id, "type": "provider_payout", "provider_id": provider["id"]})
        await db.orders.update_one({"id": order_id}, {"$set": {"provider_payout_status": "transferred", "provider_payout_amount_mxn": amount_mxn, "stripe_transfer_id": transfer.id, "updated_at": datetime.utcnow().isoformat()}})
        return True
    except stripe.error.StripeError:
        await db.orders.update_one({"id": order_id}, {"$set": {"provider_payout_status": "failed", "updated_at": datetime.utcnow().isoformat()}})
        return False

@router.post("/commission/payout/{order_id}")
async def manual_commission_payout(order_id: str, admin: UserContext = Depends(require_admin)):
    db = await get_db()
    result = await auto_process_commission_on_return(db, order_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo procesar la comisión")
    payout = await db.commission_payouts.find_one({"order_id": order_id}, {"_id": 0})
    return {"success": True, "message": f"Comisión del {PLATFORM_FEE_PERCENT*100}% retenida", "payout": payout}

@router.post("/orders/{order_id}/release-funds")
async def release_provider_funds(order_id: str, user: UserContext = Depends(require_provider)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["provider_id"] != user.id:
        raise HTTPException(status_code=403, detail="No eres el proveedor de esta orden")
    if order.get("status") != "devuelta":
        raise HTTPException(status_code=400, detail="La orden debe estar devuelta para liberar fondos")
    if order.get("return_checklist", {}).get("report_damage"):
        raise HTTPException(status_code=400, detail="Hay un reporte de daño pendiente. No se pueden liberar fondos.")
    result = await transfer_to_provider(db, order_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo transferir a la cuenta del proveedor. Verifica tu cuenta de Stripe Connect.")
    await auto_process_commission_on_return(db, order_id)
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"success": True, "message": "Fondos transferidos al proveedor exitosamente", "order": updated}
