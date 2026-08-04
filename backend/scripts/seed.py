#!/usr/bin/env python3
"""
Seed inicial de Pal Jale.

Crea:
- Usuario admin inicial (ADMIN_EMAIL / ADMIN_PASSWORD)
- Configuración global inicial (payments_enabled: true)

Uso:
    cd backend
    ./venv/Scripts/python.exe scripts/seed.py
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from passlib.context import CryptContext
from bson import ObjectId

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from database import init_indexes, db

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@paljale.mx")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


async def seed_admin():
    if not ADMIN_PASSWORD:
        print("ERROR: ADMIN_PASSWORD no está configurado en el .env")
        return False

    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing:
        print(f"Admin {ADMIN_EMAIL} ya existe. Omitiendo.")
        return True

    user_id = f"usr_{ObjectId()}"
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    await db.users.insert_one({
        "id": user_id,
        "email": ADMIN_EMAIL.lower(),
        "password_hash": pwd_context.hash(ADMIN_PASSWORD),
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
    print(f"Admin creado: {ADMIN_EMAIL}")
    return True


async def seed_settings():
    existing = await db.settings.find_one({"key": "global"})
    if existing:
        print("Configuración global ya existe. Omitiendo.")
        return

    from datetime import datetime
    await db.settings.insert_one({
        "key": "global",
        "payments_enabled": True,
        "kill_switch_reason": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    })
    print("Configuración global creada: payments_enabled=true")


async def main():
    await init_indexes()
    await seed_admin()
    await seed_settings()
    print("Seed completado.")


if __name__ == "__main__":
    asyncio.run(main())
