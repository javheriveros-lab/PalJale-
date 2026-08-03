from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from bson import ObjectId

from database import get_db
from auth_utils import get_current_user, UserContext
from notifications import on_inspector_en_route, on_inspector_on_site, on_inspection_completed

router = APIRouter(prefix="/api/inspections", tags=["Inspections"])


class InspectionCreate(BaseModel):
    order_id: str
    notes: Optional[str] = ""


class InspectionStatusUpdate(BaseModel):
    status: str  # programada, en_ruta, en_sitio, completada, cancelada


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _can_access_inspection(db, inspection: dict, user: UserContext):
    order = await db.orders.find_one({"id": inspection["order_id"]})
    if not order:
        return False
    if user.role == "admin":
        return True
    return order["user_id"] == user.id or order["provider_id"] == user.id


@router.get("/")
async def list_inspections(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    if user.role == "admin":
        query = {}
    else:
        orders = await db.orders.find(
            {"$or": [{"user_id": user.id}, {"provider_id": user.id}]},
            {"id": 1},
        ).to_list(length=200)
        order_ids = [o["id"] for o in orders]
        query = {"order_id": {"$in": order_ids}}

    items = await db.inspections.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return {"items": items}


@router.post("/")
async def create_inspection(payload: InspectionCreate, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": payload.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["user_id"] != user.id and order["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")

    now = datetime.utcnow().isoformat()
    inspection_doc = {
        "id": f"insp_{ObjectId()}",
        "order_id": payload.order_id,
        "requester_id": user.id,
        "status": "programada",
        "notes": payload.notes,
        "inspector_id": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.inspections.insert_one(inspection_doc)
    return _serialize(inspection_doc)


@router.get("/{inspection_id}")
async def get_inspection(inspection_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    inspection = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspección no encontrada")
    if not await _can_access_inspection(db, inspection, user):
        raise HTTPException(status_code=403, detail="No autorizado")
    return inspection


@router.patch("/{inspection_id}/status")
async def update_inspection_status(
    inspection_id: str,
    payload: InspectionStatusUpdate,
    user: UserContext = Depends(get_current_user),
):
    db = await get_db()
    inspection = await db.inspections.find_one({"id": inspection_id})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspección no encontrada")
    if not await _can_access_inspection(db, inspection, user):
        raise HTTPException(status_code=403, detail="No autorizado")

    await db.inspections.update_one(
        {"id": inspection_id},
        {"$set": {"status": payload.status, "updated_at": datetime.utcnow().isoformat()}},
    )

    order = await db.orders.find_one({"id": inspection["order_id"]})
    if order:
        if payload.status == "en_ruta":
            await on_inspector_en_route(db, order["user_id"], order["id"])
        elif payload.status == "en_sitio":
            await on_inspector_on_site(db, order["user_id"], order["id"])
        elif payload.status == "completada":
            await on_inspection_completed(db, order["user_id"], order["id"])

    updated = await db.inspections.find_one({"id": inspection_id}, {"_id": 0})
    return updated
