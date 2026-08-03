from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from storage import upload_base64_to_s3
from notifications import on_order_delivered, on_order_returned, on_damage_reported

router = APIRouter(tags=["Orders Checklist"])


def _upload_photos(photos: list, folder: str) -> list:
    urls = []
    for photo in photos:
        if isinstance(photo, str) and photo.startswith("data:"):
            urls.append(upload_base64_to_s3(photo, folder, "jpg"))
        elif isinstance(photo, str) and photo.startswith("http"):
            urls.append(photo)
        elif isinstance(photo, str):
            urls.append(photo)
    return urls


async def _require_order_access(db, order_id: str, user_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["user_id"] != user_id and order["provider_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    return order


@router.post("/api/orders/{order_id}/checklist/delivery")
async def delivery_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user.id)

    if order["status"] not in ("en_transito", "pickup_listo", "aceptada"):
        raise HTTPException(status_code=400, detail=f"No se puede entregar una orden en estado {order['status']}")

    photos = payload.get("fotos_b64", [])
    if not isinstance(photos, list):
        photos = [photos]

    foto_urls = _upload_photos(photos, f"checklists/{order_id}/delivery")
    now = datetime.utcnow().isoformat()
    checklist = {
        "foto_urls": foto_urls,
        "estado": payload.get("estado", ""),
        "kilometraje": payload.get("kilometraje"),
        "notas": payload.get("notas", ""),
        "signed_by": None,
        "signed_at": None,
        "signature_url": None,
        "timestamp": now,
    }

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "delivery_checklist": checklist,
                "status": "entregada",
                "delivered_at": now,
                "updated_at": now,
            }
        },
    )
    await on_order_delivered(db, order["user_id"], order_id)
    return {"success": True}


@router.post("/api/orders/{order_id}/checklist/return")
async def return_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user.id)

    if order["status"] != "entregada":
        raise HTTPException(status_code=400, detail="La orden debe estar entregada para reportar devolución")

    photos = payload.get("fotos_b64", [])
    if not isinstance(photos, list):
        photos = [photos]

    foto_urls = _upload_photos(photos, f"checklists/{order_id}/return")
    report_damage = bool(payload.get("report_damage", False))
    damage_notes = payload.get("damage_notes", "")
    now = datetime.utcnow().isoformat()
    checklist = {
        "foto_urls": foto_urls,
        "report_damage": report_damage,
        "damage_notes": damage_notes,
        "notes": payload.get("notes", ""),
        "signed_by": None,
        "signed_at": None,
        "signature_url": None,
        "timestamp": now,
    }

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "return_checklist": checklist,
                "status": "devuelta",
                "returned_at": now,
                "updated_at": now,
            }
        },
    )

    if report_damage:
        await on_damage_reported(db, order["user_id"], order_id, fanout_admins=True)
    else:
        await on_order_returned(db, order["user_id"], order_id)

    return {"success": True}
