#!/usr/bin/env python3
"""
Seed de productos de prueba para Pal Jale.

Crea un usuario "proveedor" de demostración (si no existe) y una docena
de productos de ejemplo (maquinaria, herramientas, materiales, mano de
obra) con imágenes de prueba (picsum.photos), para poder ver el catálogo
y el detalle de producto con contenido real en vez de la grilla vacía.

Usa bcrypt directo (no passlib) para el password_hash del proveedor demo,
así que esto corre incluso si el backend desplegado todavía tiene el bug
conocido de passlib+bcrypt 4.1+/5.x (ver .claude/napkin.md) — no depende
de que el deploy más reciente ya esté activo.

Uso:
    cd backend
    ./venv/Scripts/python.exe scripts/seed_products.py
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

import bcrypt
from bson import ObjectId
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from database import init_indexes, db

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DEMO_PROVIDER_EMAIL = "proveedor.demo@paljale.mx"
DEMO_PROVIDER_PASSWORD = "DemoPalJale2026!"

PRODUCTS = [
    {
        "title": "Excavadora compacta CAT 305 (renta por día)",
        "description": "Excavadora compacta ideal para zanjas, cimentaciones y demoliciones en espacios reducidos. Incluye operador certificado y traslado dentro de la ZMG.",
        "category": "maquinaria",
        "transaction_type": "renta",
        "price_mxn": 4500,
        "deposit_mxn": 8000,
        "image_seed": "cat-excavator-site",
        "rating": 4.8,
    },
    {
        "title": "Montacargas eléctrico 2.5 ton (renta semanal)",
        "description": "Montacargas eléctrico para bodega y obra, capacidad 2.5 toneladas. Mantenimiento al día, batería con 8 horas de autonomía.",
        "category": "maquinaria",
        "transaction_type": "renta",
        "price_mxn": 6200,
        "deposit_mxn": 10000,
        "image_seed": "forklift-warehouse",
        "rating": 4.6,
    },
    {
        "title": "Revolvedora de concreto 1 saco (venta)",
        "description": "Revolvedora a gasolina de 1 saco, ideal para obra chica y remodelaciones. Como nueva, dos meses de uso.",
        "category": "maquinaria",
        "transaction_type": "venta",
        "price_mxn": 9800,
        "deposit_mxn": None,
        "image_seed": "concrete-mixer-yard",
        "rating": 4.3,
    },
    {
        "title": "Taladro rotomartillo profesional 850W",
        "description": "Rotomartillo para concreto y mampostería, incluye maletín y 3 brocas SDS. Ideal para instalación eléctrica e hidráulica.",
        "category": "herramientas",
        "transaction_type": "venta",
        "price_mxn": 1850,
        "deposit_mxn": None,
        "image_seed": "power-drill-toolbox",
        "rating": 4.7,
    },
    {
        "title": "Andamio tubular 2x1m (renta, juego de 4)",
        "description": "Juego de 4 cuerpos de andamio tubular galvanizado con plataforma y escalera. Entrega e instalación incluida en área metropolitana.",
        "category": "herramientas",
        "transaction_type": "renta",
        "price_mxn": 1200,
        "deposit_mxn": 3000,
        "image_seed": "scaffolding-building",
        "rating": 4.5,
    },
    {
        "title": "Soldadora inversora 200A",
        "description": "Soldadora inversora ligera para electrodo y TIG básico, ideal para herrería y mantenimiento industrial.",
        "category": "herramientas",
        "transaction_type": "venta",
        "price_mxn": 3200,
        "deposit_mxn": None,
        "image_seed": "welding-machine-shop",
        "rating": 0,
    },
    {
        "title": "Cemento gris 50kg (pallet de 40 sacos)",
        "description": "Cemento Portland gris tipo CPC 30R, pallet completo de 40 sacos de 50kg. Entrega a obra incluida dentro del área metropolitana.",
        "category": "materiales",
        "transaction_type": "venta",
        "price_mxn": 14800,
        "deposit_mxn": None,
        "image_seed": "cement-bags-pallet",
        "rating": 4.4,
    },
    {
        "title": "Varilla corrugada 3/8\" (tonelada)",
        "description": "Varilla corrugada grado 42, 3/8 de pulgada, por tonelada. Certificada, ideal para losas y castillos.",
        "category": "materiales",
        "transaction_type": "venta",
        "price_mxn": 21500,
        "deposit_mxn": None,
        "image_seed": "rebar-steel-stack",
        "rating": 4.9,
    },
    {
        "title": "Block hueco de concreto 15x20x40 (millar)",
        "description": "Millar de block hueco de concreto, medida estándar 15x20x40cm, para muros de carga y divisorios.",
        "category": "materiales",
        "transaction_type": "venta",
        "price_mxn": 9200,
        "deposit_mxn": None,
        "image_seed": "concrete-blocks-stack",
        "rating": 0,
    },
    {
        "title": "Electricista certificado - instalación residencial",
        "description": "Instalación y mantenimiento eléctrico residencial y comercial, certificado por 8 años de experiencia. Incluye diagnóstico inicial.",
        "category": "personal",
        "transaction_type": "renta",
        "price_mxn": 850,
        "deposit_mxn": None,
        "image_seed": "electrician-residential",
        "rating": 4.9,
    },
    {
        "title": "Plomero profesional - fugas e instalación",
        "description": "Reparación de fugas, instalación de tinacos, calentadores y redes hidrosanitarias. Visita de diagnóstico sin costo.",
        "category": "personal",
        "transaction_type": "renta",
        "price_mxn": 650,
        "deposit_mxn": None,
        "image_seed": "plumber-residential",
        "rating": 4.6,
    },
    {
        "title": "Albañil con cuadrilla - obra gris",
        "description": "Cuadrilla de 3 albañiles para obra gris: cimentación, muros, aplanados y colados. Cotización por día o por destajo.",
        "category": "personal",
        "transaction_type": "renta",
        "price_mxn": 2400,
        "deposit_mxn": None,
        "image_seed": "construction-crew-site",
        "rating": 4.2,
    },
]


def picsum_url(seed: str, width: int = 900, height: int = 700) -> str:
    return f"https://picsum.photos/seed/{seed}/{width}/{height}"


async def get_or_create_demo_provider() -> str:
    existing = await db.users.find_one({"email": DEMO_PROVIDER_EMAIL})
    if existing:
        print(f"Proveedor demo ya existe: {DEMO_PROVIDER_EMAIL} (id={existing['id']})")
        return existing["id"]

    password_hash = bcrypt.hashpw(DEMO_PROVIDER_PASSWORD.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")
    user_id = f"usr_{ObjectId()}"
    now = datetime.utcnow().isoformat()
    await db.users.insert_one({
        "id": user_id,
        "email": DEMO_PROVIDER_EMAIL,
        "password_hash": password_hash,
        "full_name": "Proveedor Demo Pal Jale",
        "phone": "33 1234 5678",
        "role": "proveedor",
        "address": "Guadalajara, Jalisco",
        "profession": "Renta de maquinaria y materiales",
        "experience_years": 10,
        "verification_status": "verificado",
        "kyc_data": None,
        "rating": 4.7,
        "reviews_count": 32,
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
    })
    print(f"Proveedor demo creado: {DEMO_PROVIDER_EMAIL} / {DEMO_PROVIDER_PASSWORD} (id={user_id})")
    return user_id


async def seed_products(provider_id: str):
    created = 0
    skipped = 0
    now = datetime.utcnow().isoformat()
    for p in PRODUCTS:
        existing = await db.products.find_one({"title": p["title"], "provider_id": provider_id})
        if existing:
            skipped += 1
            continue
        product_id = f"prd_{ObjectId()}"
        await db.products.insert_one({
            "id": product_id,
            "title": p["title"],
            "description": p["description"],
            "category": p["category"],
            "transaction_type": p["transaction_type"],
            "price_mxn": p["price_mxn"],
            "deposit_mxn": p["deposit_mxn"],
            "image_url": picsum_url(p["image_seed"]),
            "provider_id": provider_id,
            "lat": 20.6597 + (created * 0.01),
            "lng": -103.3496 + (created * 0.01),
            "rating": p["rating"],
            "unavailable_dates": [],
            "created_at": now,
        })
        created += 1
    print(f"Productos creados: {created}. Ya existían (omitidos): {skipped}.")


async def main():
    await init_indexes()
    provider_id = await get_or_create_demo_provider()
    await seed_products(provider_id)
    print("Seed de productos completado.")


if __name__ == "__main__":
    asyncio.run(main())
