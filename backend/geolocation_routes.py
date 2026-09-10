import re
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, get_optional_current_user, UserContext
from geolocation import haversine, delivery_fee

router = APIRouter(tags=["Geolocation"])

@router.get("/api/products/nearby")
async def nearby_products(lat: float = Query(...), lng: float = Query(...), max_km: float = Query(20.0), category: Optional[str] = None, transaction_type: Optional[str] = None, q: Optional[str] = None, limit: int = Query(50, le=100), user: Optional[UserContext] = Depends(get_optional_current_user)):
    db = await get_db()
    pipeline = []
    match_stage = {"lat": {"$exists": True, "$ne": None}, "lng": {"$exists": True, "$ne": None}}
    if category: match_stage["category"] = category
    if transaction_type: match_stage["transaction_type"] = transaction_type
    if q:
        safe_q = re.escape(q.strip())
        match_stage["$or"] = [{"title": {"$regex": safe_q, "$options": "i"}}, {"description": {"$regex": safe_q, "$options": "i"}}]
    pipeline.append({"$match": match_stage})
    deg2rad = 0.017453292519943295
    haversine_field = {
        "$let": {
            "vars": {
                "dlat": {"$multiply": [{"$subtract": ["$lat", lat]}, deg2rad]},
                "dlng": {"$multiply": [{"$subtract": ["$lng", lng]}, deg2rad]},
                "a": {
                    "$add": [
                        {"$multiply": [{"$sin": {"$divide": ["$$dlat", 2]}}, {"$sin": {"$divide": ["$$dlat", 2]}}]},
                        {"$multiply": [
                            {"$cos": {"$multiply": ["$lat", deg2rad]}},
                            {"$cos": {"$multiply": [lat, deg2rad]}},
                            {"$sin": {"$divide": ["$$dlng", 2]}},
                            {"$sin": {"$divide": ["$$dlng", 2]}}
                        ]}
                    ]
                }
            },
            "in": {
                "$multiply": [
                    6371,
                    {"$multiply": [2, {"$atan2": [{"$sqrt": "$$a"}, {"$sqrt": {"$subtract": [1, "$$a"]}}]}]}
                ]
            }
        }
    }
    pipeline.append({"$addFields": {"distance_km": haversine_field}})
    pipeline.append({"$match": {"distance_km": {"$lte": max_km}}})
    pipeline.append({"$sort": {"distance_km": 1}})
    pipeline.append({"$limit": limit})
    pipeline.append({"$project": {"_id": 0}})
    items = await db.products.aggregate(pipeline).to_list(length=limit)
    return {"items": items, "center": {"lat": lat, "lng": lng}, "radius_km": max_km}

@router.post("/api/orders/{order_id}/delivery-fee")
async def calculate_order_delivery_fee(order_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    order = await db.orders.find_one({"id": order_id})
    if not order or (order["user_id"] != user.id and order["provider_id"] != user.id):
        raise HTTPException(status_code=403, detail="No autorizado")
    delivery_lat = payload.get("delivery_lat") or order.get("delivery_lat")
    delivery_lng = payload.get("delivery_lng") or order.get("delivery_lng")
    if not delivery_lat or not delivery_lng:
        raise HTTPException(status_code=400, detail="Ubicación de entrega requerida")
    product = await db.products.find_one({"id": order["product_id"]})
    if not product or not product.get("lat") or not product.get("lng"):
        raise HTTPException(status_code=400, detail="Ubicación del proveedor no disponible")
    distance = haversine(product["lat"], product["lng"], delivery_lat, delivery_lng)
    fee = delivery_fee(distance)
    await db.orders.update_one({"id": order_id}, {"$set": {"delivery_lat": delivery_lat, "delivery_lng": delivery_lng, "delivery_fee_mxn": fee, "delivery_distance_km": round(distance, 2), "updated_at": datetime.utcnow().isoformat()}})
    return {"distance_km": round(distance, 2), "delivery_fee_mxn": fee, "provider_location": {"lat": product["lat"], "lng": product["lng"]}, "delivery_location": {"lat": delivery_lat, "lng": delivery_lng}}
