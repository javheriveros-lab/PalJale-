from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from bson import ObjectId
import json

router = APIRouter(prefix="/api/chat", tags=["Chat"])

TEMPLATES = {
    "en_camino": "🚛 Voy en camino con el equipo.",
    "llegue_punto": "📍 Ya llegué al punto de entrega.",
    "demora_10min": "⏱️ Tendré una demora de 10 minutos.",
    "equipo_listo": "✅ El equipo está listo para recogerse.",
    "gracias": "🙏 Gracias por usar Pal Jale.",
}


async def _require_order_access(db, order_id: str, user_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user_id and order["provider_id"] != user_id):
        raise HTTPException(status_code=403, detail="No autorizado")
    return order


def _resolve_receiver_id(order: dict, sender_id: str) -> str:
    if order["user_id"] == sender_id:
        return order["provider_id"]
    return order["user_id"]


async def _serialize_message(db, msg: dict) -> dict:
    sender = await db.users.find_one({"id": msg["sender_id"]}, {"email": 1, "full_name": 1})
    return {
        "id": msg["id"],
        "order_id": msg["order_id"],
        "sender_id": msg["sender_id"],
        "sender_email": sender.get("email") if sender else None,
        "sender_role": msg.get("sender_role", "cliente"),
        "receiver_id": msg.get("receiver_id"),
        "content": msg["content"],
        "template_key": msg.get("template_key"),
        "read_at": msg.get("read_at"),
        "created_at": msg["created_at"],
    }


@router.get("/{order_id}/messages")
async def get_chat_messages_legacy(order_id: str, limit: int = 50, before: str = None, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await _require_order_access(db, order_id, user.id)
    query = {"order_id": order_id}
    if before:
        query["id"] = {"$lt": before}
    cursor = db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    serialized = [await _serialize_message(db, i) for i in reversed(items)]
    return {"items": serialized}


@router.get("/orders/{order_id}/messages")
async def get_chat_messages(order_id: str, limit: int = 50, before: str = None, user: UserContext = Depends(get_current_user)):
    return await get_chat_messages_legacy(order_id, limit, before, user)


async def _post_message(db, order_id: str, sender_id: str, payload: dict):
    order = await _require_order_access(db, order_id, sender_id)
    content = payload.get("content", "").strip()
    template_key = payload.get("template_key")
    if template_key and template_key in TEMPLATES:
        content = TEMPLATES[template_key]
    if not content:
        raise HTTPException(status_code=400, detail="Mensaje vacío")

    sender = await db.users.find_one({"id": sender_id}, {"role": 1})
    receiver_id = _resolve_receiver_id(order, sender_id)
    msg = {
        "id": f"msg_{ObjectId()}",
        "order_id": order_id,
        "sender_id": sender_id,
        "sender_role": sender.get("role", "cliente") if sender else "cliente",
        "receiver_id": receiver_id,
        "content": content,
        "template_key": template_key,
        "read_at": None,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.chat_messages.insert_one(msg)
    return msg


@router.post("/{order_id}/messages")
async def post_chat_message_legacy(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    msg = await _post_message(db, order_id, user.id, payload)
    return await _serialize_message(db, msg)


@router.post("/orders/{order_id}/messages")
async def post_chat_message(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    return await post_chat_message_legacy(order_id, payload, user)


@router.post("/orders/{order_id}/read")
async def mark_messages_as_read(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await _require_order_access(db, order_id, user.id)
    now = datetime.utcnow().isoformat()
    result = await db.chat_messages.update_many(
        {"order_id": order_id, "receiver_id": user.id, "read_at": None},
        {"$set": {"read_at": now}},
    )
    return {"success": True, "marked_count": result.modified_count}


@router.get("/conversations")
async def list_conversations(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    orders = await db.orders.find(
        {"$or": [{"user_id": user.id}, {"provider_id": user.id}]},
        {"id": 1, "user_id": 1, "provider_id": 1, "product_title": 1},
    ).to_list(length=200)

    items = []
    for order in orders:
        other_id = order["provider_id"] if user.id == order["user_id"] else order["user_id"]
        other = await db.users.find_one({"id": other_id}, {"email": 1, "full_name": 1})
        last_msg = await db.chat_messages.find_one(
            {"order_id": order["id"]},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        unread = await db.chat_messages.count_documents(
            {"order_id": order["id"], "receiver_id": user.id, "read_at": None}
        )
        items.append({
            "order_id": order["id"],
            "other_user_id": other_id,
            "other_user_email": other.get("email") if other else None,
            "other_user_name": other.get("full_name") if other else None,
            "last_message": last_msg["content"] if last_msg else None,
            "last_message_at": last_msg["created_at"] if last_msg else None,
            "unread_count": unread,
        })
    return {"items": items}


@router.websocket("/ws/{order_id}")
async def chat_websocket(websocket: WebSocket, order_id: str, token: str = Query(...)):
    db = await get_db()
    try:
        from auth_utils import JWT_SECRET, ALGORITHM
        from jose import jwt, JWTError
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        await websocket.close(code=4001)
        return
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user_id and order["provider_id"] != user_id):
        await websocket.close(code=4003)
        return
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            parsed = json.loads(data)
            content = parsed.get("content", "").strip()
            template_key = parsed.get("template_key")
            if template_key and template_key in TEMPLATES:
                content = TEMPLATES[template_key]
            if not content:
                continue
            sender_role = payload.get("role", "cliente")
            receiver_id = _resolve_receiver_id(order, user_id)
            msg = {
                "id": f"msg_{ObjectId()}",
                "order_id": order_id,
                "sender_id": user_id,
                "sender_role": sender_role,
                "receiver_id": receiver_id,
                "content": content,
                "template_key": template_key,
                "read_at": None,
                "created_at": datetime.utcnow().isoformat(),
            }
            await db.chat_messages.insert_one(msg)
            await websocket.send_text(json.dumps(await _serialize_message(db, msg)))
    except WebSocketDisconnect:
        pass
