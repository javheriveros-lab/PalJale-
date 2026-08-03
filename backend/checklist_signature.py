from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from storage import upload_base64_to_s3

router = APIRouter(tags=["Checklist Signatures"])

@router.patch("/api/orders/{order_id}/checklist/delivery/signature")
async def sign_delivery_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    signature_data = payload.get("signature_b64", "")
    signature_url = upload_base64_to_s3(signature_data, f"signatures/{order_id}", "png") if signature_data and signature_data.startswith("data:") else signature_data
    await db.orders.update_one({"id": order_id}, {"$set": {"delivery_checklist.signature_b64": signature_url, "delivery_checklist.signed_by": user.id, "delivery_checklist.signed_at": datetime.utcnow().isoformat()}})
    return {"success": True, "signature_url": signature_url}

@router.patch("/api/orders/{order_id}/checklist/return/signature")
async def sign_return_checklist(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    signature_data = payload.get("signature_b64", "")
    signature_url = upload_base64_to_s3(signature_data, f"signatures/{order_id}", "png") if signature_data and signature_data.startswith("data:") else signature_data
    await db.orders.update_one({"id": order_id}, {"$set": {"return_checklist.signature_b64": signature_url, "return_checklist.signed_by": user.id, "return_checklist.signed_at": datetime.utcnow().isoformat()}})
    return {"success": True, "signature_url": signature_url}
