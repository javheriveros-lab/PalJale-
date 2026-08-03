import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, validator
from passlib.context import CryptContext
from jose import jwt
from bson import ObjectId

from database import get_db
from auth_utils import get_current_user, UserContext, require_admin, JWT_SECRET, ALGORITHM, ADMIN_EMAIL

router = APIRouter(prefix="/api/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("ACCESS_TOKEN_EXPIRE_DAYS", "30"))


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    phone: str
    role: str
    address: str | None = None
    profession: str | None = None
    experience_years: int | None = None

    @validator("email")
    def email_lower(cls, v):
        return v.strip().lower()

    @validator("role")
    def valid_role(cls, v):
        if v not in ("cliente", "proveedor", "profesional"):
            raise ValueError("Rol inválido")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @validator("email")
    def email_lower(cls, v):
        return v.strip().lower()


def _hash_password(password: str) -> str:
    return pwd_context.hash(password)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(user_id: str, email: str, role: str) -> str:
    expires = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": user_id, "email": email, "role": role, "exp": expires}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def _serialize_user(doc: dict) -> dict:
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@router.post("/register")
async def register(payload: RegisterRequest):
    db = await get_db()
    existing = await db.users.find_one({"email": payload.email})
    if existing:
        raise HTTPException(status_code=409, detail="El correo ya está registrado")

    user_id = f"usr_{ObjectId()}"
    now = datetime.utcnow().isoformat()
    user_doc = {
        "id": user_id,
        "email": payload.email,
        "password_hash": _hash_password(payload.password),
        "full_name": payload.full_name,
        "phone": payload.phone,
        "role": payload.role,
        "address": payload.address,
        "profession": payload.profession,
        "experience_years": payload.experience_years,
        "verification_status": "pendiente",
        "kyc_data": None,
        "rating": 0.0,
        "reviews_count": 0,
        "is_pro": False,
        "pro_status": None,
        "pro_subscription_id": None,
        "stripe_customer_id": None,
        "stripe_connect_account_id": None,
        "stripe_connect_status": None,
        "stripe_connect_charges_enabled": False,
        "stripe_connect_payouts_enabled": False,
        "default_payment_method_id": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.users.insert_one(user_doc)
    token = _create_access_token(user_id, user_doc["email"], user_doc["role"])
    return {"access_token": token, "user": _serialize_user(user_doc)}


@router.post("/login")
async def login(payload: LoginRequest):
    db = await get_db()
    user = await db.users.find_one({"email": payload.email})
    if not user or not _verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    token = _create_access_token(user["id"], user["email"], user["role"])
    return {"access_token": token}


@router.get("/me")
async def me(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    doc = await db.users.find_one({"id": user.id}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return doc


@router.post("/seed-admin")
async def seed_admin():
    """Crea el usuario admin inicial si no existe. Requiere ADMIN_EMAIL y ADMIN_PASSWORD en el .env."""
    db = await get_db()
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing:
        return {"success": False, "message": "El admin ya existe"}

    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD no configurado")

    user_id = f"usr_{ObjectId()}"
    now = datetime.utcnow().isoformat()
    await db.users.insert_one({
        "id": user_id,
        "email": ADMIN_EMAIL.lower(),
        "password_hash": _hash_password(password),
        "full_name": "Administrador Pal Jale",
        "phone": "",
        "role": "admin",
        "verification_status": "verificado",
        "rating": 0.0,
        "reviews_count": 0,
        "is_pro": False,
        "created_at": now,
        "updated_at": now,
    })
    return {"success": True, "message": "Admin creado"}


@router.post("/users/{user_id}/verify", dependencies=[Depends(require_admin)])
async def verify_user(user_id: str):
    db = await get_db()
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"verification_status": "verificado", "updated_at": datetime.utcnow().isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {"success": True}
