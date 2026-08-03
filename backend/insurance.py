from fastapi import APIRouter
from database import get_db

router = APIRouter(prefix="/api/insurance", tags=["Insurance"])

@router.post("/quote")
async def insurance_quote(payload: dict):
    subtotal = payload.get("subtotal_mxn", 0)
    rate = 0.03
    fee = round(subtotal * rate, 2)
    return {"insurance_percent": rate * 100, "insurance_fee_mxn": fee, "covered": "Daños por accidente y robo con violencia", "exclusions": "Negligencia, uso indebido, desgaste natural"}
