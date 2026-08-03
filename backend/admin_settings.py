from fastapi import APIRouter, Depends
from database import get_db
from auth_utils import require_admin, UserContext

router = APIRouter(prefix="/api/admin/settings", tags=["Admin Settings"])

@router.get("/")
async def get_settings(admin: UserContext = Depends(require_admin)):
    db = await get_db()
    settings = await db.settings.find_one({"key": "global"}, {"_id": 0})
    return settings or {"payments_enabled": True, "kill_switch_reason": None}

@router.patch("/")
async def update_settings(payload: dict, admin: UserContext = Depends(require_admin)):
    db = await get_db()
    await db.settings.update_one({"key": "global"}, {"$set": payload, "$setOnInsert": {"key": "global"}}, upsert=True)
    return {"success": True}
