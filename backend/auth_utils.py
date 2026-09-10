import os
from fastapi import Depends, HTTPException, status, Header
from jose import jwt, JWTError
from pydantic import BaseModel

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret")
ALGORITHM = "HS256"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@paljale.mx")

class UserContext(BaseModel):
    id: str
    email: str
    role: str

async def get_current_user(authorization: str = Header(None)) -> UserContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role", "cliente")
        if not user_id or not email:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return UserContext(id=user_id, email=email, role=role)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def get_optional_current_user(authorization: str = Header(None)) -> UserContext | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        role = payload.get("role", "cliente")
        if not user_id or not email:
            return None
        return UserContext(id=user_id, email=email, role=role)
    except JWTError:
        return None

async def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

async def require_super_admin(user: UserContext = Depends(require_admin)) -> UserContext:
    if user.email.lower() != ADMIN_EMAIL.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
    return user

async def require_provider(user: UserContext = Depends(get_current_user)) -> UserContext:
    if user.role not in ("proveedor", "profesional"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Provider access required")
    return user
