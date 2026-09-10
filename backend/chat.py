import json
from collections import defaultdict
from datetime import datetime
from typing import Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from database import get_db
from auth_utils import get_current_user, UserContext, JWT_SECRET, ALGORITHM
from jose import jwt, JWTError
from bson import ObjectId

router = APIRouter(prefix="/api/chat", tags=["Chat"])

TEMPLATES = {
    "en_camino": "🚛 Voy en camino con el equipo.",
    "llegue_punto": "📍 Ya llegué al punto de entrega.",
    "demora_10min": "⏱️ Tendré una demora de 10 minutos.",
    "equipo_listo": "✅ El equipo está listo para recogerse.",
    "gracias": "🙏 Gracias por usar Pal Jale."
}

class ChatConnectionManager:
    def __init__(self):
        self.active_rooms: defaultdict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, order_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_rooms[order_id].add(websocket)

    def disconnect(self, order_id: str, websocket: WebSocket):
        if order_id in self.active_rooms:
            self.active_rooms[order_id].discard(websocket)
            if not self.active_rooms[order_id]:
                del self.active_rooms[order_id]

    async def broadcast(self, order_id: str, message: dict):
        if order_id in self.active_rooms:
            serialized = json.dumps(message)
            dead_sockets = set()
            for ws in self.active_rooms[order_id]:
                try:
                    await ws.send_text(serialized)
                except Exception:
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.active_rooms[order_id].discard(ws)

manager = ChatConnectionManager()

async def _fetch_messages(order_id: str, limit: int, before: Optional[str], user: UserContext):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id and user.role != "admin"):
        raise HTTPException(status_code=403, detail="No autorizado")
    query = {"order_id": order_id}
    if before:
        query["id"] = {"$lt": before}
    cursor = db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": list(reversed(items))}

async def _send_message(order_id: str, payload: dict, user: UserContext):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id and user.role != "admin"):
        raise HTTPException(status_code=403, detail="No autorizado")
    content = payload.get("content", "").strip()
    template_key = payload.get("template_key")
    if template_key and template_key in TEMPLATES:
        content = TEMPLATES[template_key]
    if not content:
        raise HTTPException(status_code=400, detail="Mensaje vacío")
    
    receiver_id = order["provider_id"] if user.id == order["user_id"] else order["user_id"]
    now_iso = datetime.utcnow().isoformat()
    msg = {
        "id": f"msg_{ObjectId()}",
        "order_id": order_id,
        "sender_id": user.id,
        "sender_email": user.email,
        "sender_role": user.role,
        "receiver_id": receiver_id,
        "content": content,
        "template_key": template_key,
        "read_at": None,
        "created_at": now_iso,
    }
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    await manager.broadcast(order_id, msg)
    return msg

@router.get("/conversations")
async def list_conversations(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    orders = await db.orders.find(
        {"$or": [{"user_id": user.id}, {"provider_id": user.id}]},
        {"_id": 0, "id": 1, "user_id": 1, "provider_id": 1, "product_title": 1}
    ).to_list(length=100)

    results = []
    for o in orders:
        order_id = o["id"]
        other_user_id = o["provider_id"] if o["user_id"] == user.id else o["user_id"]
        other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "full_name": 1, "email": 1})
        last_msg = await db.chat_messages.find_one({"order_id": order_id}, {"_id": 0}, sort=[("created_at", -1)])
        unread = await db.chat_messages.count_documents({"order_id": order_id, "receiver_id": user.id, "read_at": None})
        results.append({
            "order_id": order_id,
            "product_title": o.get("product_title", ""),
            "other_user_id": other_user_id,
            "other_user_email": other_user.get("email", "") if other_user else "",
            "other_user_name": other_user.get("full_name", "") if other_user else "",
            "last_message": last_msg.get("content", "") if last_msg else None,
            "last_message_at": last_msg.get("created_at") if last_msg else None,
            "unread_count": unread,
        })
    results.sort(key=lambda x: x["last_message_at"] or "", reverse=True)
    return {"items": results}

@router.get("/{order_id}/messages")
async def get_chat_messages(order_id: str, limit: int = 50, before: Optional[str] = None, user: UserContext = Depends(get_current_user)):
    return await _fetch_messages(order_id, limit, before, user)

@router.get("/orders/{order_id}/messages")
async def get_order_chat_messages(order_id: str, limit: int = 50, before: Optional[str] = None, user: UserContext = Depends(get_current_user)):
    return await _fetch_messages(order_id, limit, before, user)

@router.post("/{order_id}/messages")
async def post_chat_message(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    return await _send_message(order_id, payload, user)

@router.post("/orders/{order_id}/messages")
async def post_order_chat_message(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    return await _send_message(order_id, payload, user)

@router.post("/orders/{order_id}/read")
@router.post("/{order_id}/read")
async def mark_chat_read(order_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id and user.role != "admin"):
        raise HTTPException(status_code=403, detail="No autorizado")
    now_iso = datetime.utcnow().isoformat()
    res = await db.chat_messages.update_many(
        {"order_id": order_id, "sender_id": {"$ne": user.id}, "read_at": None},
        {"$set": {"read_at": now_iso}}
    )
    return {"success": True, "marked_count": res.modified_count}

@router.websocket("/ws/{order_id}")
async def chat_websocket(websocket: WebSocket, order_id: str, token: str = Query(...)):
    db = await get_db()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user_id and order["provider_id"] != user_id):
        await websocket.close(code=4003)
        return
    await manager.connect(order_id, websocket)
    receiver_id = order["provider_id"] if user_id == order["user_id"] else order["user_id"]
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
            now_iso = datetime.utcnow().isoformat()
            msg = {
                "id": f"msg_{ObjectId()}",
                "order_id": order_id,
                "sender_id": user_id,
                "sender_email": payload.get("email", ""),
                "sender_role": payload.get("role", "cliente"),
                "receiver_id": receiver_id,
                "content": content,
                "template_key": template_key,
                "read_at": None,
                "created_at": now_iso,
            }
            await db.chat_messages.insert_one(msg)
            msg.pop("_id", None)
            await manager.broadcast(order_id, msg)
    except WebSocketDisconnect:
        manager.disconnect(order_id, websocket)
    except Exception:
        manager.disconnect(order_id, websocket)

