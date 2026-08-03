from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from storage import upload_base64_to_s3

router = APIRouter(tags=["Checklist Signatures"])


async def _require_order_access(db, order_id: str, user_id: str):
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order["user_id"] != user_id and order["provider_id"] != user_id:
        raise HTTPException(status_code=403, detail="No autorizado")
    return order


@router.patch("/api/orders/{order_id}/checklist/delivery/signature")
async def sign_delivery_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user.id)

    if order["status"] not in ("en_transito", "pickup_listo", "aceptada"):
        raise HTTPException(status_code=400, detail="No se puede firmar entrega en este estado")

    signature_data = payload.get("signature_b64", "")
    signature_url = upload_base64_to_s3(signature_data, f"signatures/{order_id}/delivery", "png") if signature_data and signature_data.startswith("data:") else signature_data
    now = datetime.utcnow().isoformat()

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "delivery_checklist.signature_url": signature_url,
                "delivery_checklist.signed_by": user.id,
                "delivery_checklist.signed_at": now,
                "updated_at": now,
            }
        },
    )
    return {"success": True, "signature_url": signature_url}


@router.patch("/api/orders/{order_id}/checklist/return/signature")
async def sign_return_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await _require_order_access(db, order_id, user.id)

    if order["status"] != "entregada":
        raise HTTPException(status_code=400, detail="No se puede firmar devolución en este estado")

    signature_data = payload.get("signature_b64", "")
    signature_url = upload_base64_to_s3(signature_data, f"signatures/{order_id}/return", "png") if signature_data and signature_data.startswith("data:") else signature_data
    now = datetime.utcnow().isoformat()

    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "return_checklist.signature_url": signature_url,
                "return_checklist.signed_by": user.id,
                "return_checklist.signed_at": now,
                "updated_at": now,
            }
        },
    )
    return {"success": True, "signature_url": signature_url}
