from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext

router = APIRouter(prefix="/api/push", tags=["Push Notifications"])

@router.post("/register")
async def register_push_token(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    token = payload.get("token")
    platform = payload.get("platform", "unknown")
    if not token:
        raise HTTPException(status_code=400, detail="Token requerido")
    await db.push_tokens.update_one({"user_id": user.id, "token": token}, {"$set": {"platform": platform, "updated_at": datetime.utcnow()}}, upsert=True)
    return {"success": True}

@router.delete("/register")
async def unregister_push_token_legacy(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    token = payload.get("token")
    await db.push_tokens.delete_one({"user_id": user.id, "token": token})
    return {"success": True}


@router.delete("/unregister")
async def unregister_push_token(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    token = payload.get("token")
    await db.push_tokens.delete_one({"user_id": user.id, "token": token})
    return {"success": True}


@router.get("/tokens")
async def list_push_tokens(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    tokens = await db.push_tokens.find({"user_id": user.id}, {"_id": 0}).to_list(length=50)
    return {"items": tokens}


@router.post("/send-test")
async def send_test_push(user: UserContext = Depends(get_current_user)):
    from notifications import notify_user_push
    await notify_user_push(user.id, "Prueba Pal Jale", "Esta es una notificación de prueba.", {"type": "test"})
    return {"success": True, "message": "Notificación de prueba enviada"}
