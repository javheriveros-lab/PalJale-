#!/usr/bin/env python3
"""
Crea el usuario administrador inicial de Pal Jale.

Uso:
    cd backend
    ./venv/Scripts/python.exe scripts/create_admin.py

Requiere las variables ADMIN_EMAIL y ADMIN_PASSWORD en el archivo .env.
"""
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from passlib.context import CryptContext
from bson import ObjectId

# Asegurar que podamos importar database.py
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from database import init_indexes, db

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@paljale.mx")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


async def main():
    if not ADMIN_PASSWORD:
        print("ERROR: ADMIN_PASSWORD no está configurado en el .env")
        sys.exit(1)

    await init_indexes()

    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if existing:
        print(f"El admin {ADMIN_EMAIL} ya existe. No se realizaron cambios.")
        return

    user_id = f"usr_{ObjectId()}"
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
    print(f"Admin creado exitosamente: {ADMIN_EMAIL}")


if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(main())
