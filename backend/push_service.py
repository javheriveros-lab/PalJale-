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
async def unregister_push_token(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    token = payload.get("token")
    await db.push_tokens.delete_one({"user_id": user.id, "token": token})
    return {"success": True}
