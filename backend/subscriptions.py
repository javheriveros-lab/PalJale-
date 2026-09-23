import os
import stripe
from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import require_provider, UserContext

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions Pro"])

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY no está configurada.")
stripe.api_key = STRIPE_SECRET_KEY
PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "price_pro_mock")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://paljale.mx")

@router.post("/pro")
async def subscribe_pro(user: UserContext = Depends(require_provider)):
    db = await get_db()
    doc = await db.users.find_one({"id": user.id})
    customer_id = doc.get("stripe_customer_id") if doc else None
    if not customer_id:
        customer = stripe.Customer.create(email=user.email, metadata={"paljale_user_id": user.id})
        customer_id = customer.id
        await db.users.update_one({"id": user.id}, {"$set": {"stripe_customer_id": customer_id, "updated_at": datetime.utcnow().isoformat()}})
    session = stripe.checkout.Session.create(mode="subscription", customer=customer_id, line_items=[{"price": PRO_PRICE_ID, "quantity": 1}], success_url=f"{FRONTEND_URL}/provider/subscription?success=1", cancel_url=f"{FRONTEND_URL}/provider/subscription?canceled=1", metadata={"paljale_user_id": user.id, "type": "pro_subscription"})
    return {"url": session.url, "session_id": session.id}

@router.get("/pro/status")
async def get_pro_status(user: UserContext = Depends(require_provider)):
    db = await get_db()
    doc = await db.users.find_one({"id": user.id})
    sub_id = doc.get("pro_subscription_id") if doc else None
    if not sub_id:
        return {"is_pro": False, "status": "inactive", "current_period_end": None, "cancel_at_period_end": False}
    try:
        sub = stripe.Subscription.retrieve(sub_id)
        is_pro = sub.status in ("active", "trialing")
        await db.users.update_one({"id": user.id}, {"$set": {"is_pro": is_pro, "pro_status": sub.status, "pro_expires_at": datetime.fromtimestamp(sub.current_period_end).isoformat() if hasattr(sub, 'current_period_end') else None, "pro_cancel_at_period_end": sub.cancel_at_period_end, "updated_at": datetime.utcnow().isoformat()}})
        return {"is_pro": is_pro, "status": sub.status, "current_period_end": sub.current_period_end, "cancel_at_period_end": sub.cancel_at_period_end}
    except stripe.error.StripeError:
        return {"is_pro": doc.get("is_pro", False), "status": "error", "current_period_end": None, "cancel_at_period_end": doc.get("pro_cancel_at_period_end", False)}

@router.post("/pro/cancel")
async def cancel_pro(user: UserContext = Depends(require_provider)):
    db = await get_db()
    doc = await db.users.find_one({"id": user.id})
    sub_id = doc.get("pro_subscription_id") if doc else None
    if not sub_id:
        raise HTTPException(status_code=400, detail="No tienes una suscripción activa")
    try:
        stripe.Subscription.modify(sub_id, cancel_at_period_end=True)
        await db.users.update_one({"id": user.id}, {"$set": {"pro_cancel_at_period_end": True, "updated_at": datetime.utcnow().isoformat()}})
        return {"success": True, "message": "Tu suscripción Pro se cancelará al final del período actual"}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/featured-products")
async def featured_pro_products(limit: int = 10):
    db = await get_db()
    pro_users = await db.users.find({"is_pro": True}, {"id": 1}).to_list(length=100)
    pro_ids = [u["id"] for u in pro_users]
    pipeline = [
        {"$match": {"provider_id": {"$in": pro_ids}}},
        {"$sort": {"rating": -1, "created_at": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0}}
    ]
    items = await db.products.aggregate(pipeline).to_list(length=limit)
    return {"items": items}
