import os
import logging
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from datetime import datetime
from typing import Optional
from pymongo.errors import DuplicateKeyError
from database import get_db
from auth_utils import get_current_user, UserContext, require_admin, require_provider
from bson import ObjectId
from models import SetupIntentResponse, PaymentMethodCard, OneTapPaymentRequest
from admin_bank import decrypt_card_number

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["Payments"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY no está configurada.")
stripe.api_key = STRIPE_SECRET_KEY
PLATFORM_FEE_PERCENT = 0.05
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://paljale.mx")
CHECKOUT_PAYMENT_METHOD_TYPES = ["card", "oxxo", "customer_balance"]
CHECKOUT_PAYMENT_METHOD_OPTIONS = {
    "customer_balance": {
        "funding_type": "bank_transfer",
        "bank_transfer": {"type": "mx_bank_transfer"},
    }
}

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

async def ensure_stripe_customer(db, user_id: str, email: str) -> str:
    user = await db.users.find_one({"id": user_id})
    if user and user.get("stripe_customer_id"):
        return user["stripe_customer_id"]
    try:
        customer = stripe.Customer.create(email=email, metadata={"paljale_user_id": user_id})
    except stripe.error.StripeError as e:
        logger.error("Fallo creando cliente de Stripe para user %s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Error al comunicarse con Stripe")
    await db.users.update_one({"id": user_id}, {"$set": {"stripe_customer_id": customer.id, "updated_at": datetime.utcnow().isoformat()}})
    return customer.id

@router.post("/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    customer_id = await ensure_stripe_customer(db, user.id, user.email)
    try:
        intent = stripe.SetupIntent.create(customer=customer_id, payment_method_types=["card"], metadata={"paljale_user_id": user.id})
    except stripe.error.StripeError as e:
        logger.error("Fallo creando SetupIntent para user %s: %s", user.id, e)
        raise HTTPException(status_code=502, detail="Error al comunicarse con Stripe")
    return {"client_secret": intent.client_secret, "stripe_customer_id": customer_id}

@router.get("/payment-methods")
async def list_payment_methods(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    user_doc = await db.users.find_one({"id": user.id})
    customer_id = user_doc.get("stripe_customer_id") if user_doc else None
    if not customer_id:
        return {"items": []}
    try:
        methods = stripe.PaymentMethod.list(customer=customer_id, type="card")
    except stripe.error.StripeError as e:
        logger.error("Fallo listando métodos de pago de Stripe para user %s: %s", user.id, e)
        raise HTTPException(status_code=502, detail="Error al comunicarse con Stripe")
    items = []
    for m in methods.data:
        items.append(PaymentMethodCard(id=m.id, brand=m.card.brand, last4=m.card.last4, exp_month=m.card.exp_month, exp_year=m.card.exp_year, is_default=(m.id == user_doc.get("default_payment_method_id"))))
    return {"items": items}

@router.get("/admin/users/{user_id}/payment-methods-summary")
async def admin_payment_methods_summary(user_id: str, admin: UserContext = Depends(require_admin)):
    """Resumen de solo lectura para soporte: nunca expone IDs de Stripe completos ni permite borrar."""
    db = await get_db()
    user_doc = await db.users.find_one({"id": user_id})
    if not user_doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    customer_id = user_doc.get("stripe_customer_id")
    if not customer_id:
        return {"count": 0, "cards": []}
    try:
        methods = stripe.PaymentMethod.list(customer=customer_id, type="card")
    except stripe.error.StripeError as e:
        logger.error("Fallo listando métodos de pago (admin) para user %s: %s", user_id, e)
        raise HTTPException(status_code=502, detail="Error al comunicarse con Stripe")
    cards = [{"brand": m.card.brand, "last4": m.card.last4} for m in methods.data]
    return {"count": len(cards), "cards": cards}

@router.delete("/payment-methods/{pm_id}")
async def delete_payment_method(pm_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    user_doc = await db.users.find_one({"id": user.id})
    customer_id = user_doc.get("stripe_customer_id") if user_doc else None
    try:
        pm = stripe.PaymentMethod.retrieve(pm_id)
    except stripe.error.StripeError:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado")
    if not customer_id or pm.customer != customer_id:
        raise HTTPException(status_code=403, detail="Este método de pago no te pertenece")
    try:
        stripe.PaymentMethod.detach(pm_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.users.update_one({"id": user.id, "default_payment_method_id": pm_id}, {"$unset": {"default_payment_method_id": ""}})
    return {"success": True}

@router.post("/checkout-session")
async def create_checkout_session(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    settings = await db.settings.find_one({"key": "global"})
    if settings and settings.get("payments_enabled") is False:
        reason = settings.get("kill_switch_reason") or "Mantenimiento temporal"
        raise HTTPException(status_code=503, detail=f"Kill Switch activo: {reason}")
    order_id = payload.get("order_id")
    order = await db.orders.find_one({"id": order_id, "user_id": user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    customer_id = await ensure_stripe_customer(db, user.id, user.email)
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer_id,
            payment_method_types=CHECKOUT_PAYMENT_METHOD_TYPES,
            payment_method_options=CHECKOUT_PAYMENT_METHOD_OPTIONS,
            line_items=[{
                "price_data": {
                    "currency": "mxn",
                    "product_data": {"name": f"Pal Jale - {order.get('product_title', 'Orden ' + order_id)}"},
                    "unit_amount": round(order["total_mxn"] * 100),
                },
                "quantity": 1,
            }],
            metadata={"type": "order_payment", "order_id": order_id, "paljale_user_id": user.id},
            success_url=f"{FRONTEND_URL}/orders?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/orders?payment=canceled",
            idempotency_key=f"checkout-order-{order_id}",
        )
    except stripe.error.StripeError as e:
        logger.error("Fallo creando Checkout Session para orden %s: %s", order_id, e)
        raise HTTPException(status_code=502, detail="Error al comunicarse con Stripe")
    await db.orders.update_one({"id": order_id}, {"$set": {"stripe_session_id": session.id, "stripe_session_url": session.url, "payment_status": "pending", "stripe_customer_id": customer_id}})
    return {"url": session.url, "session_id": session.id}

async def create_checkout_session_for_orders(db, user: UserContext, orders: list):
    """Crea una Checkout Session real de Stripe para un lote de órdenes ya existentes.

    Reutilizado tanto por el endpoint HTTP /checkout-session/cart como por
    cart.py justo después de crear las órdenes del carrito, para no duplicar
    la lógica de armado de la sesión de Stripe.
    """
    settings = await db.settings.find_one({"key": "global"})
    if settings and settings.get("payments_enabled") is False:
        reason = settings.get("kill_switch_reason") or "Mantenimiento temporal"
        raise HTTPException(status_code=503, detail=f"Kill Switch activo: {reason}")
    order_ids = [o["id"] for o in orders]
    customer_id = await ensure_stripe_customer(db, user.id, user.email)
    line_items = [{
        "price_data": {
            "currency": "mxn",
            "product_data": {"name": f"Pal Jale - {o.get('product_title', 'Orden ' + o['id'])}"},
            "unit_amount": round(o["total_mxn"] * 100),
        },
        "quantity": 1,
    } for o in orders]
    joined_ids = ",".join(order_ids)
    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            customer=customer_id,
            payment_method_types=CHECKOUT_PAYMENT_METHOD_TYPES,
            payment_method_options=CHECKOUT_PAYMENT_METHOD_OPTIONS,
            line_items=line_items,
            metadata={"type": "cart_checkout", "order_ids": joined_ids, "paljale_user_id": user.id},
            success_url=f"{FRONTEND_URL}/cart?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_URL}/cart?payment=canceled",
            idempotency_key=f"checkout-cart-{joined_ids}",
        )
    except stripe.error.StripeError as e:
        logger.error("Fallo creando Checkout Session de carrito para user %s: %s", user.id, e)
        raise HTTPException(status_code=502, detail="Error al comunicarse con Stripe")
    await db.orders.update_many({"id": {"$in": order_ids}}, {"$set": {"stripe_session_id": session.id, "payment_status": "pending", "stripe_customer_id": customer_id}})
    return {"url": session.url, "session_id": session.id}

@router.post("/checkout-session/cart")
async def create_cart_checkout_session(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order_ids = payload.get("order_ids") or []
    if not order_ids:
        raise HTTPException(status_code=400, detail="Se requiere al menos un order_id")
    orders = await db.orders.find({"id": {"$in": order_ids}, "user_id": user.id}).to_list(length=len(order_ids))
    if len(orders) != len(order_ids):
        raise HTTPException(status_code=404, detail="Una o más órdenes no existen o no te pertenecen")
    return await create_checkout_session_for_orders(db, user, orders)

@router.post("/one-tap")
async def one_tap_payment(payload: OneTapPaymentRequest, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    settings = await db.settings.find_one({"key": "global"})
    if settings and settings.get("payments_enabled") is False:
        reason = settings.get("kill_switch_reason") or "Mantenimiento temporal"
        raise HTTPException(status_code=503, detail=f"Kill Switch activo: {reason}")
    order = await db.orders.find_one({"id": payload.order_id, "user_id": user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    total_cents = round(order["total_mxn"] * 100)
    try:
        intent = stripe.PaymentIntent.create(
            amount=total_cents,
            currency="mxn",
            customer=order.get("stripe_customer_id"),
            payment_method=payload.payment_method_id,
            off_session=True,
            confirm=True,
            metadata={"order_id": payload.order_id, "type": "one_tap"},
            idempotency_key=f"onetap-{payload.order_id}",
        )
        now_iso = datetime.utcnow().isoformat()
        await db.orders.update_one({"id": payload.order_id}, {"$set": {"payment_status": "paid", "paid_at": now_iso, "updated_at": now_iso, "stripe_payment_intent_id": intent.id}})
        return {"success": True, "payment_intent_id": intent.id, "status": intent.status}
    except stripe.error.CardError as e:
        raise HTTPException(status_code=400, detail=e.user_message or "Tarjeta rechazada")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="STRIPE_WEBHOOK_SECRET no configurado")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Webhook error: {str(e)}")

    event_type = event.get("type")
    data_obj = event.get("data", {}).get("object", {})
    db = await get_db()
    now_iso = datetime.utcnow().isoformat()

    if event_type == "checkout.session.completed":
        session = data_obj
        meta = session.get("metadata", {})
        meta_type = meta.get("type")
        payment_intent_id = session.get("payment_intent")
        if meta_type == "pro_subscription":
            user_id = meta.get("paljale_user_id")
            sub_id = session.get("subscription")
            if user_id and sub_id:
                await db.users.update_one({"id": user_id}, {"$set": {"is_pro": True, "pro_subscription_id": sub_id, "pro_status": "active", "updated_at": now_iso}})
        elif meta_type == "cart_checkout":
            order_ids = [oid for oid in meta.get("order_ids", "").split(",") if oid]
            if order_ids:
                await db.orders.update_many({"id": {"$in": order_ids}}, {"$set": {"payment_status": "paid", "paid_at": now_iso, "updated_at": now_iso, "stripe_payment_intent_id": payment_intent_id}})
        else:
            order_id = meta.get("order_id")
            if order_id:
                await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "paid", "paid_at": now_iso, "updated_at": now_iso, "stripe_payment_intent_id": payment_intent_id}})
    elif event_type == "invoice.paid":
        sub_id = data_obj.get("subscription")
        if sub_id:
            await db.users.update_one({"pro_subscription_id": sub_id}, {"$set": {"is_pro": True, "pro_status": "active", "updated_at": now_iso}})
    elif event_type == "customer.subscription.deleted":
        sub_id = data_obj.get("id")
        if sub_id:
            await db.users.update_one({"pro_subscription_id": sub_id}, {"$set": {"is_pro": False, "pro_status": "canceled", "updated_at": now_iso}})
    return {"status": "success"}

@router.post("/confirm/{order_id}")
async def confirm_payment_manual(order_id: str, admin: UserContext = Depends(require_admin)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    now_iso = datetime.utcnow().isoformat()
    await db.orders.update_one({"id": order_id}, {"$set": {"payment_status": "paid", "paid_at": now_iso, "updated_at": now_iso, "stripe_payment_intent_id": f"pi_manual_{ObjectId()}"}})
    return {"success": True, "message": "Pago confirmado manualmente por administrador"}

@router.post("/deposit/{order_id}/release")
async def release_deposit(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo el proveedor o admin pueden liberar el depósito")
    if order.get("deposit_status") != "held":
        raise HTTPException(status_code=400, detail="Depósito no retenido")
    if not order.get("stripe_payment_intent_id"):
        raise HTTPException(status_code=400, detail="Esta orden no tiene un cargo real de Stripe asociado; no hay nada que reembolsar")
    deposit_mxn = order.get("deposit_mxn", 0)
    if deposit_mxn <= 0:
        raise HTTPException(status_code=400, detail="Esta orden no tiene depósito de garantía")

    now_iso = datetime.utcnow().isoformat()
    claimed = await db.orders.find_one_and_update(
        {"id": order_id, "deposit_status": "held"},
        {"$set": {"deposit_status": "releasing", "updated_at": now_iso}},
    )
    if claimed is None:
        raise HTTPException(status_code=400, detail="El depósito ya está siendo procesado o ya se resolvió")

    try:
        refund = stripe.Refund.create(
            payment_intent=order["stripe_payment_intent_id"],
            amount=round(deposit_mxn * 100),
            metadata={"order_id": order_id, "reason": "deposit_release"},
            idempotency_key=f"deposit-release-{order_id}",
        )
    except stripe.error.StripeError as e:
        logger.error("Fallo reembolsando depósito de orden %s: %s", order_id, e)
        await db.orders.update_one({"id": order_id}, {"$set": {"deposit_status": "held", "updated_at": datetime.utcnow().isoformat()}})
        raise HTTPException(status_code=502, detail="No se pudo procesar el reembolso con Stripe")

    await db.orders.update_one({"id": order_id}, {"$set": {"deposit_status": "released", "stripe_refund_id": refund.id, "updated_at": datetime.utcnow().isoformat()}})
    return {"success": True, "message": "Depósito liberado y reembolsado", "stripe_refund_id": refund.id}

@router.post("/deposit/{order_id}/capture")
async def capture_deposit(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo el proveedor o admin pueden capturar el depósito")
    claimed = await db.orders.find_one_and_update(
        {"id": order_id, "deposit_status": "held"},
        {"$set": {"deposit_status": "captured", "updated_at": datetime.utcnow().isoformat()}},
    )
    if claimed is None:
        raise HTTPException(status_code=400, detail="Depósito no retenido o ya se resolvió")
    return {"success": True, "message": "Depósito capturado por daño: el monto ya cobrado se retiene, no se reembolsa"}

@router.get("/success", response_class=HTMLResponse)
async def payment_success():
    return HTML_TEMPLATE.format(title="¡Pago Exitoso!", message="Tu transacción se completó correctamente.")

@router.get("/cancel", response_class=HTMLResponse)
async def payment_cancel():
    return HTML_TEMPLATE.format(title="Pago Cancelado", message="La transacción fue cancelada o no se completó.")

async def auto_process_commission_on_return(db, order_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        return False
    if order.get("payment_status") != "paid":
        return False
    if order.get("status") not in ["entregada", "devuelta"]:
        return False
    bank_config = await db.bank_configs.find_one({"is_active": True})
    if not bank_config:
        return False
    subtotal = order.get("subtotal_mxn", 0)
    commission_amount = order.get("platform_fee_mxn", subtotal * PLATFORM_FEE_PERCENT)
    now_iso = datetime.utcnow().isoformat()
    payout_record = {
        "id": f"po_{ObjectId()}",
        "order_id": order_id,
        "amount_mxn": round(commission_amount, 2),
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
        "bank_config_snapshot": {"bank_name": bank_config["bank_name"], "account_holder": bank_config["account_holder"], "card_number_last4": decrypt_card_number(bank_config["card_number"])[-4:]},
        "status": "pending",
        "stripe_transfer_id": None,
        "processed_at": None,
        "created_at": now_iso
    }
    try:
        await db.commission_payouts.insert_one(payout_record)
    except DuplicateKeyError:
        # Ya existe un payout de comisión para esta orden (índice único en order_id) — evita duplicados por llamadas concurrentes.
        return True
    await db.commission_payouts.update_one({"id": payout_record["id"]}, {"$set": {"status": "completed", "processed_at": now_iso, "stripe_transfer_id": f"tr_mock_{ObjectId()}"}})
    return True

async def transfer_to_provider(db, order_id: str):
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

    claimed = await db.orders.find_one_and_update(
        {"id": order_id, "provider_payout_status": {"$nin": ["transferred", "processing"]}},
        {"$set": {"provider_payout_status": "processing", "updated_at": datetime.utcnow().isoformat()}},
    )
    if claimed is None:
        current = await db.orders.find_one({"id": order_id}, {"provider_payout_status": 1})
        return bool(current and current.get("provider_payout_status") == "transferred")

    amount_cents = round(amount_mxn * 100)
    account_id = provider["stripe_connect_account_id"]
    try:
        transfer = stripe.Transfer.create(
            amount=amount_cents,
            currency="mxn",
            destination=account_id,
            metadata={"order_id": order_id, "type": "provider_payout", "provider_id": provider["id"]},
            idempotency_key=f"transfer-{order_id}",
        )
        await db.orders.update_one({"id": order_id}, {"$set": {"provider_payout_status": "transferred", "provider_payout_amount_mxn": amount_mxn, "stripe_transfer_id": transfer.id, "updated_at": datetime.utcnow().isoformat()}})
        return True
    except stripe.error.StripeError as e:
        logger.error("Fallo transfiriendo a proveedor %s (orden %s): %s", provider["id"], order_id, e)
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
