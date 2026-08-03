from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from storage import upload_base64_to_s3

router = APIRouter(prefix="/api/auth", tags=["Auth KYC"])

@router.post("/verify")
async def verify_kyc(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    ine_data = payload.get("ine_front_b64", "")
    selfie_data = payload.get("selfie_b64", "")
    ine_url = upload_base64_to_s3(ine_data, f"kyc/{user.id}", "jpg") if ine_data and ine_data.startswith("data:") else ine_data
    selfie_url = upload_base64_to_s3(selfie_data, f"kyc/{user.id}", "jpg") if selfie_data and selfie_data.startswith("data:") else selfie_data
    await db.users.update_one({"id": user.id}, {"$set": {"kyc_data": {"ine_front_b64": ine_url, "selfie_b64": selfie_url, "submitted_at": datetime.utcnow().isoformat()}, "verification_status": "en_revision", "updated_at": datetime.utcnow().isoformat()}})
    return {"success": True, "message": "Documentos enviados a revisión"}
