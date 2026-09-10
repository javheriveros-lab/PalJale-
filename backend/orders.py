from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel
from bson import ObjectId

from database import get_db
from auth_utils import get_current_user, UserContext, require_provider
from notifications import (
    on_new_order,
    on_order_accepted,
    on_order_rejected,
    on_pickup_ready,
    on_shipment_departed,
    on_order_delivered,
)

router = APIRouter(prefix="/api", tags=["Orders"])

STATUS_FLOW = {
    "creada": ["aceptada", "rechazada", "cancelada"],
    "aceptada": ["pickup_listo", "cancelada"],
    "pickup_listo": ["en_transito"],
    "en_transito": ["entregada"],
    "entregada": ["devuelta"],
    "devuelta": [],
    "rechazada": [],
    "cancelada": [],
}


class OrderCreateRequest(BaseModel):
    product_id: str
    delivery_method: Literal["pickup", "dropoff"] = "dropoff"
    delivery_address: Optional[str] = ""
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    quantity: Optional[int] = 1
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    status: str


class LocationUpdate(BaseModel):
    lat: float
    lng: float
    status: Optional[str] = None


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _require_order_access(db, order_id: str, user: UserContext):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["user_id"] != user.id and order["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")
    return order


@router.post("/orders")
async def create_order(payload: OrderCreateRequest, user: UserContext = Depends(get_current_user)):
    db = await get_db()

    user_doc = await db.users.find_one({"id": user.id})
    if not user_doc or user_doc.get("verification_status") != "verificado":
        raise HTTPException(status_code=403, detail="Usuario no verificado. Completa tu KYC.")

    product = await db.products.find_one({"id": payload.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if product["provider_id"] == user.id:
        raise HTTPException(status_code=400, detail="No puedes ordenar tu propio producto")

    qty = max(1, payload.quantity or 1)
    days = 1
    if product["transaction_type"] == "renta" and payload.start_date and payload.end_date:
        try:
            d1 = datetime.strptime(payload.start_date, "%Y-%m-%d")
            d2 = datetime.strptime(payload.end_date, "%Y-%m-%d")
            days = max(1, (d2 - d1).days + 1)
        except ValueError:
            pass

    subtotal = product["price_mxn"] * qty * days
    deposit = (product.get("deposit_mxn") or 0) * qty if product["transaction_type"] == "renta" else 0
    platform_fee = round(subtotal * 0.05, 2)
    total = subtotal + deposit + platform_fee

    order_id = f"ord_{ObjectId()}"
    now = datetime.utcnow().isoformat()
    order_doc = {
        "id": order_id,
        "user_id": user.id,
        "provider_id": product["provider_id"],
        "product_id": product["id"],
        "product_title": product["title"],
        "transaction_type": product["transaction_type"],
        "quantity": qty,
        "days": days,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "booked_dates": [],
        "dates_committed": False,
        "hold_expires_at": None,
        "delivery_address": payload.delivery_address or "",
        "delivery_method": payload.delivery_method,
        "delivery_lat": payload.delivery_lat,
        "delivery_lng": payload.delivery_lng,
        "delivery_fee_mxn": 0,
        "delivery_distance_km": 0,
        "subtotal_mxn": round(subtotal, 2),
        "deposit_mxn": round(deposit, 2),
        "platform_fee_mxn": platform_fee,
        "insurance_enabled": False,
        "insurance_fee_mxn": 0,
        "insurance_percent": 0,
        "total_mxn": round(total, 2),
        "status": "creada",
        "payment_status": "unpaid",
        "deposit_status": "held",
        "extended_hold": False,
        "provider_payout_status": "pending",
        "tracking_active": False,
        "current_location": None,
        "tracking_history": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.orders.insert_one(order_doc)
    await on_new_order(db, product["provider_id"], order_id)
    return _serialize(order_doc)


@router.get("/orders/me")
async def my_orders(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    items = await db.orders.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return {"items": items}


@router.get("/my/orders/provider")
async def provider_orders(user: UserContext = Depends(require_provider)):
    db = await get_db()
    items = await db.orders.find({"provider_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return {"items": items}


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user)
    return _serialize(order)


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: StatusUpdateRequest,
    user: UserContext = Depends(get_current_user),
):
    db = await get_db()
    order = await _require_order_access(db, order_id, user)
    current = order["status"]
    new_status = payload.status

    valid_next = STATUS_FLOW.get(current, [])
    if new_status not in valid_next:
        raise HTTPException(status_code=400, detail=f"Transición inválida de {current} a {new_status}")

    # Permisos por transición
    if new_status in ("aceptada", "rechazada", "pickup_listo", "en_transito"):
        if order["provider_id"] != user.id and user.role != "admin":
            raise HTTPException(status_code=403, detail="Solo el proveedor puede cambiar a este estado")

    if new_status == "cancelada" and user.role != "admin":
        if current != "creada":
            raise HTTPException(status_code=400, detail="Solo se puede cancelar una orden recién creada")
        if order["user_id"] != user.id and order["provider_id"] != user.id:
            raise HTTPException(status_code=403, detail="No autorizado")

    if new_status == "devuelta":
        raise HTTPException(status_code=400, detail="Usa el checklist de devolución para marcar como devuelta")

    if new_status == "entregada":
        # También se marca desde el checklist de entrega
        raise HTTPException(status_code=400, detail="Usa el checklist de entrega para marcar como entregada")

    updates = {"status": new_status, "updated_at": datetime.utcnow().isoformat()}
    await db.orders.update_one({"id": order_id}, {"$set": updates})

    if new_status == "aceptada":
        await on_order_accepted(db, order["user_id"], order_id)
    elif new_status == "rechazada":
        await on_order_rejected(db, order["user_id"], order_id)
    elif new_status == "pickup_listo":
        await on_pickup_ready(db, order["user_id"], order_id)
    elif new_status == "en_transito":
        await on_shipment_departed(db, order["user_id"], order_id)

    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated


@router.post("/orders/{order_id}/location/start")
async def start_tracking(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user)
    if order["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo el proveedor o admin pueden iniciar el rastreo")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"tracking_active": True, "updated_at": datetime.utcnow().isoformat()}},
    )
    return {"success": True, "tracking_active": True}


@router.patch("/orders/{order_id}/location")
async def update_location(
    order_id: str,
    payload: LocationUpdate,
    user: UserContext = Depends(get_current_user),
):
    db = await get_db()
    order = await _require_order_access(db, order_id, user)
    if order["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo el proveedor o admin pueden actualizar la ubicación")
    point = {
        "lat": payload.lat,
        "lng": payload.lng,
        "status": payload.status or "en_camino",
        "timestamp": datetime.utcnow().isoformat(),
    }
    await db.orders.update_one(
        {"id": order_id},
        {
            "$push": {"tracking_history": {"$each": [point], "$slice": -100}},
            "$set": {"current_location": point, "updated_at": datetime.utcnow().isoformat()},
        },
    )
    return {"success": True, "location": point}


@router.get("/orders/{order_id}/location")
async def get_location(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user)
    return {
        "current_location": order.get("current_location"),
        "tracking_active": order.get("tracking_active", False),
        "history": order.get("tracking_history", []),
    }
