import re
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, validator
from bson import ObjectId

from database import get_db
from auth_utils import get_current_user, get_optional_current_user, UserContext

router = APIRouter(prefix="/api", tags=["Products"])


class ProductCreate(BaseModel):
    title: str
    description: str = ""
    category: str
    transaction_type: str
    price_mxn: float = Field(..., gt=0)
    deposit_mxn: Optional[float] = None
    image_url: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    unavailable_dates: Optional[List[str]] = []

    @validator("category")
    def valid_category(cls, v):
        if v not in ("maquinaria", "herramientas", "materiales", "personal"):
            raise ValueError("Categoría inválida")
        return v

    @validator("transaction_type")
    def valid_transaction_type(cls, v):
        if v not in ("venta", "renta"):
            raise ValueError("Tipo de transacción inválido")
        return v


class ProductUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    transaction_type: Optional[str] = None
    price_mxn: Optional[float] = None
    deposit_mxn: Optional[float] = None
    image_url: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    unavailable_dates: Optional[List[str]] = None

    @validator("category")
    def valid_category(cls, v):
        if v is None:
            return v
        if v not in ("maquinaria", "herramientas", "materiales", "personal"):
            raise ValueError("Categoría inválida")
        return v

    @validator("transaction_type")
    def valid_transaction_type(cls, v):
        if v is None:
            return v
        if v not in ("venta", "renta"):
            raise ValueError("Tipo de transacción inválido")
        return v


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


@router.get("/products")
async def list_products(
    q: Optional[str] = None,
    category: Optional[str] = None,
    transaction_type: Optional[str] = None,
    limit: int = Query(50, le=100),
    skip: int = Query(0, ge=0),
    user: Optional[UserContext] = Depends(get_optional_current_user),
):
    db = await get_db()
    query = {}
    if category:
        query["category"] = category
    if transaction_type:
        query["transaction_type"] = transaction_type
    if q:
        safe_q = re.escape(q.strip())
        query["$or"] = [
            {"title": {"$regex": safe_q, "$options": "i"}},
            {"description": {"$regex": safe_q, "$options": "i"}},
        ]

    total = await db.products.count_documents(query)
    cursor = db.products.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "total": total, "limit": limit, "skip": skip}


@router.get("/products/{product_id}")
async def get_product(product_id: str, user: Optional[UserContext] = Depends(get_optional_current_user)):
    db = await get_db()
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.post("/products")
async def create_product(payload: ProductCreate, user: UserContext = Depends(get_current_user)):
    if user.role not in ("proveedor", "profesional", "admin"):
        raise HTTPException(status_code=403, detail="Solo proveedores pueden publicar productos")

    db = await get_db()
    now = datetime.utcnow().isoformat()
    product_doc = {
        "id": f"prd_{ObjectId()}",
        "title": payload.title,
        "description": payload.description,
        "category": payload.category,
        "transaction_type": payload.transaction_type,
        "price_mxn": payload.price_mxn,
        "deposit_mxn": payload.deposit_mxn or 0,
        "image_url": payload.image_url,
        "provider_id": user.id,
        "lat": payload.lat,
        "lng": payload.lng,
        "rating": 0.0,
        "reviews_count": 0,
        "unavailable_dates": payload.unavailable_dates or [],
        "created_at": now,
        "updated_at": now,
    }
    await db.products.insert_one(product_doc)
    return _serialize(product_doc)


@router.patch("/products/{product_id}")
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    user: UserContext = Depends(get_current_user),
):
    db = await get_db()
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if product["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="No puedes editar este producto")

    update_fields = {"updated_at": datetime.utcnow().isoformat()}
    for field, value in payload.dict(exclude_unset=True).items():
        update_fields[field] = value

    await db.products.update_one({"id": product_id}, {"$set": update_fields})
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    if product["provider_id"] != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="No puedes eliminar este producto")

    await db.products.delete_one({"id": product_id})
    return {"success": True}


@router.get("/my/products")
async def my_products(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    items = await db.products.find({"provider_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return {"items": items}
