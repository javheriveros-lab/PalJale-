from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from bson import ObjectId

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])

@router.post("/")
async def create_review(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order_id = payload.get("order_id")
    rating = payload.get("rating")
    comment = payload.get("comment", "")
    review_type = payload.get("type")
    if review_type not in ("buyer_to_provider", "provider_to_buyer"):
        raise HTTPException(status_code=400, detail="Tipo de reseña inválido")
    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating debe ser entre 1 y 5")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    if order.get("status") not in ("entregada", "devuelta"):
        raise HTTPException(status_code=400, detail="Solo puedes reseñar después de la entrega o devolución")
    if review_type == "buyer_to_provider":
        if order["user_id"] != user.id:
            raise HTTPException(status_code=403, detail="No eres el comprador de esta orden")
        reviewee_id = order["provider_id"]
    else:
        if order["provider_id"] != user.id:
            raise HTTPException(status_code=403, detail="No eres el proveedor de esta orden")
        reviewee_id = order["user_id"]
    existing = await db.reviews.find_one({"order_id": order_id, "type": review_type})
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una reseña para esta orden")
    review = {"id": f"rev_{ObjectId()}", "order_id": order_id, "reviewer_id": user.id, "reviewee_id": reviewee_id, "product_id": order["product_id"], "rating": rating, "comment": comment, "type": review_type, "created_at": datetime.utcnow().isoformat()}
    await db.reviews.insert_one(review)
    pipeline = [{"$match": {"reviewee_id": reviewee_id}}, {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    result = await db.reviews.aggregate(pipeline).to_list(length=1)
    if result:
        avg = round(result[0]["avg_rating"], 2)
        count = result[0]["count"]
        await db.users.update_one({"id": reviewee_id}, {"$set": {"rating": avg, "reviews_count": count, "updated_at": datetime.utcnow()}})
    product_pipeline = [{"$match": {"product_id": order["product_id"]}}, {"$group": {"_id": None, "avg_rating": {"$avg": "$rating"}, "count": {"$sum": 1}}}]
    prod_result = await db.reviews.aggregate(product_pipeline).to_list(length=1)
    if prod_result:
        avg = round(prod_result[0]["avg_rating"], 2)
        count = prod_result[0]["count"]
        await db.products.update_one({"id": order["product_id"]}, {"$set": {"rating": avg, "reviews_count": count}})
    return review

@router.get("/")
async def list_reviews(product_id: str = None, user_id: str = None, limit: int = 20, skip: int = 0):
    db = await get_db()
    query = {}
    if product_id:
        query["product_id"] = product_id
    if user_id:
        query["$or"] = [{"reviewee_id": user_id}, {"reviewer_id": user_id}]
    total = await db.reviews.count_documents(query)
    cursor = db.reviews.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items, "total": total, "limit": limit, "skip": skip}
