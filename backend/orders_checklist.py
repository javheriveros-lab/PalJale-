from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from storage import upload_base64_to_s3
from notifications import on_order_delivered, on_damage_reported

router = APIRouter(tags=["Orders Checklist"])

@router.post("/api/orders/{order_id}/checklist/delivery")
async def delivery_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    fotos = payload.get("fotos_b64", [])
    foto_urls = []
    for photo in fotos:
        if photo.startswith("data:"):
            foto_urls.append(upload_base64_to_s3(photo, f"checklists/{order_id}/delivery", "jpg"))
        elif photo.startswith("http"):
            foto_urls.append(photo)
        else:
            foto_urls.append(photo)
    checklist = {"fotos_b64": foto_urls, "estado": payload.get("estado", ""), "kilometraje": payload.get("kilometraje"), "notas": payload.get("notas", ""), "timestamp": datetime.utcnow().isoformat()}
    await db.orders.update_one({"id": order_id}, {"$set": {"delivery_checklist": checklist, "status": "entregada", "delivered_at": datetime.utcnow().isoformat()}})
    await on_order_delivered(db, order["user_id"], order_id)
    return {"success": True}

@router.post("/api/orders/{order_id}/checklist/return")
async def return_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    fotos = payload.get("fotos_b64", [])
    foto_urls = []
    for photo in fotos:
        if photo.startswith("data:"):
            foto_urls.append(upload_base64_to_s3(photo, f"checklists/{order_id}/return", "jpg"))
        elif photo.startswith("http"):
            foto_urls.append(photo)
        else:
            foto_urls.append(photo)
    report_damage = payload.get("report_damage", False)
    checklist = {"fotos_b64": foto_urls, "report_damage": report_damage, "notes": payload.get("notes", ""), "timestamp": datetime.utcnow().isoformat()}
    await db.orders.update_one({"id": order_id}, {"$set": {"return_checklist": checklist, "status": "devuelta"}})
    if report_damage:
        await on_damage_reported(db, order["user_id"], order_id, fanout_admins=True)
    else:
        await on_order_delivered(db, order["user_id"], order_id)
    return {"success": True}
