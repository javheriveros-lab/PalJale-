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
    "gracias": "🙏 Gracias por usar Pal Jale."
}

@router.get("/{order_id}/messages")
async def get_chat_messages(order_id: str, limit: int = 50, before: str = None, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    query = {"order_id": order_id}
    if before:
        query["id"] = {"$lt": before}
    cursor = db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": list(reversed(items))}

@router.post("/{order_id}/messages")
async def post_chat_message(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    content = payload.get("content", "").strip()
    template_key = payload.get("template_key")
    if template_key and template_key in TEMPLATES:
        content = TEMPLATES[template_key]
    if not content:
        raise HTTPException(status_code=400, detail="Mensaje vacío")
    msg = {"id": f"msg_{ObjectId()}", "order_id": order_id, "sender_id": user.id, "sender_role": user.role, "content": content, "template_key": template_key, "created_at": datetime.utcnow().isoformat()}
    await db.chat_messages.insert_one(msg)
    return msg

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
            msg = {"id": f"msg_{ObjectId()}", "order_id": order_id, "sender_id": user_id, "sender_role": payload.get("role", "cliente"), "content": content, "template_key": template_key, "created_at": datetime.utcnow().isoformat()}
            await db.chat_messages.insert_one(msg)
            await websocket.send_text(json.dumps(msg))
    except WebSocketDisconnect:
        pass
