from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from typing import Optional
from database import get_db
from auth_utils import get_current_user, UserContext
from bson import ObjectId
import httpx

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

DEDUP_WINDOW_SECONDS = 60
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def _dedup_key(user_id: str, type_: str, order_id: Optional[str], inspection_id: Optional[str]) -> str:
    return f"{user_id}:{type_}:{order_id or ''}:{inspection_id or ''}"

async def _should_emit(db, key: str) -> bool:
    window = datetime.utcnow() - timedelta(seconds=DEDUP_WINDOW_SECONDS)
    existing = await db.notification_dedup.find_one({"key": key, "emitted_at": {"$gte": window}})
    if existing:
        return False
    await db.notification_dedup.update_one({"key": key}, {"$set": {"emitted_at": datetime.utcnow()}}, upsert=True)
    return True

async def notify_user_push(user_id: str, title: str, body: str, data: dict = None):
    db = await get_db()
    tokens = await db.push_tokens.find({"user_id": user_id}).to_list(length=10)
    if not tokens:
        return
    payloads = []
    for t in tokens:
        token = t.get("token")
        if token and token.startswith("ExponentPushToken"):
            payloads.append({"to": token, "sound": "default", "title": title, "body": body, "data": data or {}, "priority": "high"})
    if not payloads:
        return
    async with httpx.AsyncClient() as client:
        try:
            await client.post(EXPO_PUSH_URL, json=payloads, headers={"Accept": "application/json", "Accept-Encoding": "gzip, deflate", "Content-Type": "application/json"})
        except Exception:
            pass

async def create_notification(db, user_id: str, type_: str, title: str, body: str, order_id: Optional[str] = None, inspection_id: Optional[str] = None, priority: str = "normal"):
    key = await _dedup_key(user_id, type_, order_id, inspection_id)
    if not await _should_emit(db, key):
        return None
    notif = {"id": f"notif_{ObjectId()}", "user_id": user_id, "type": type_, "title": title, "body": body, "order_id": order_id, "inspection_id": inspection_id, "priority": priority, "read": False, "read_at": None, "created_at": datetime.utcnow()}
    await db.notifications.insert_one(notif)
    await notify_user_push(user_id, title, body, {"type": type_, "order_id": order_id, "inspection_id": inspection_id, "notification_id": notif["id"]})
    return notif

async def on_new_order(db, provider_id: str, order_id: str):
    return await create_notification(db, provider_id, "new_order", "Nueva orden", "Tienes una nueva solicitud de orden.", order_id=order_id, priority="high")

async def on_order_accepted(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "order_accepted", "Orden aceptada", "Tu orden ha sido aceptada por el proveedor.", order_id=order_id)

async def on_order_rejected(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "order_rejected", "Orden rechazada", "Tu orden fue rechazada por el proveedor.", order_id=order_id)

async def on_pickup_ready(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "pickup_ready", "Listo para recoger", "Tu equipo está listo para recogerse.", order_id=order_id)

async def on_shipment_departed(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "shipment_departed", "En camino", "Tu equipo ha salido hacia tu ubicación.", order_id=order_id)

async def on_shipment_arrived(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "shipment_arrived", "Llegada", "El equipo ha llegado a tu ubicación.", order_id=order_id)

async def on_order_delivered(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "order_delivered", "Entregado", "El equipo ha sido entregado.", order_id=order_id)

async def on_damage_reported(db, user_id: str, order_id: str, fanout_admins: bool = False):
    notif = await create_notification(db, user_id, "damage_reported", "Daño reportado", "Se reportó un daño en la devolución.", order_id=order_id, priority="high")
    if fanout_admins:
        admins = await db.users.find({"role": "admin"}).to_list(length=50)
        for admin in admins:
            await create_notification(db, admin["id"], "damage_reported", "Daño reportado", f"Daño en orden {order_id}", order_id=order_id, priority="high")
    return notif

async def on_inspector_en_route(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "inspector_en_route", "Inspector en camino", "El técnico va en camino a tu ubicación.", order_id=order_id, priority="high")

async def on_inspector_on_site(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "inspector_on_site", "Inspector en sitio", "El técnico ha llegado al sitio.", order_id=order_id, priority="high")

async def on_inspection_completed(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "inspection_completed", "Inspección completada", "El peritaje ha sido completado.", order_id=order_id)

async def on_deposit_released(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "deposit_released", "Depósito liberado", "Tu depósito de garantía ha sido liberado.", order_id=order_id)

async def on_deposit_captured(db, user_id: str, order_id: str):
    return await create_notification(db, user_id, "deposit_captured", "Depósito retenido", "Se ha retenido tu depósito por daños reportados.", order_id=order_id, priority="high")

@router.get("/")
async def list_notifications(unread_only: bool = False, limit: int = 50, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    query = {"user_id": user.id}
    if unread_only:
        query["read"] = False
    cursor = db.notifications.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items}

@router.get("/unread-count")
async def unread_count(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    count = await db.notifications.count_documents({"user_id": user.id, "read": False})
    return {"unread": count}

@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await db.notifications.update_one({"id": notif_id, "user_id": user.id}, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    return {"success": True}

@router.post("/read-all")
async def mark_all_read(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await db.notifications.update_many({"user_id": user.id, "read": False}, {"$set": {"read": True, "read_at": datetime.utcnow()}})
    return {"success": True}
