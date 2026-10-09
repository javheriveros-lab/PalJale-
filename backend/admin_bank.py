import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from cryptography.fernet import Fernet, InvalidToken
from database import get_db
from auth_utils import require_super_admin, UserContext
from models import BankConfigRequest

logger = logging.getLogger(__name__)

BANK_DATA_ENCRYPTION_KEY = os.getenv("BANK_DATA_ENCRYPTION_KEY")
if not BANK_DATA_ENCRYPTION_KEY:
    raise RuntimeError(
        "BANK_DATA_ENCRYPTION_KEY no está configurada. Genera una con: "
        'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
    )
_fernet = Fernet(BANK_DATA_ENCRYPTION_KEY.encode())

def encrypt_card_number(card_number: str) -> str:
    return _fernet.encrypt(card_number.encode()).decode()

def decrypt_card_number(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        # Compatibilidad con configuraciones guardadas antes de habilitar el cifrado.
        logger.warning("card_number en bank_configs no está cifrado (formato legado); vuelve a guardar la configuración para cifrarlo.")
        return token

router = APIRouter(prefix="/api/admin/bank", tags=["Admin Bank Config"])

@router.get("/")
async def get_bank_config(admin: UserContext = Depends(require_super_admin)):
    db = await get_db()
    config = await db.bank_configs.find_one({"is_active": True}, {"_id": 0})
    if not config:
        return {"bank_name": None, "account_holder": None, "card_number": None, "configured": False, "is_active": False}
    card = decrypt_card_number(config.get("card_number", ""))
    masked = f"****-****-****-{card[-4:]}" if len(card) >= 4 else "****"
    return {"id": config.get("id"), "bank_name": config.get("bank_name"), "account_holder": config.get("account_holder"), "card_number": masked, "updated_by": config.get("updated_by"), "updated_at": config.get("updated_at"), "is_active": config.get("is_active"), "configured": True}

@router.post("/")
async def save_bank_config(payload: BankConfigRequest, admin: UserContext = Depends(require_super_admin)):
    db = await get_db()
    await db.bank_configs.update_many({"is_active": True}, {"$set": {"is_active": False}})
    new_config = {"id": f"bank_{int(datetime.utcnow().timestamp())}", "bank_name": payload.bank_name, "account_holder": payload.account_holder, "card_number": encrypt_card_number(payload.card_number), "updated_by": admin.email, "updated_at": datetime.utcnow(), "is_active": True}
    await db.bank_configs.insert_one(new_config)
    return {"success": True, "message": "Configuración bancaria guardada y cifrada correctamente.", "data": {"bank_name": new_config["bank_name"], "account_holder": new_config["account_holder"], "card_number": f"****-****-****-{payload.card_number[-4:]}", "updated_at": new_config["updated_at"]}}

@router.get("/commissions")
async def list_commission_payouts(limit: int = 50, skip: int = 0, admin: UserContext = Depends(require_super_admin)):
    db = await get_db()
    total = await db.commission_payouts.count_documents({})
    cursor = db.commission_payouts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "total": total, "limit": limit, "skip": skip}
