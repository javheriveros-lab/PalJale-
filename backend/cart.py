from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta
from database import get_db
from auth_utils import get_current_user, UserContext
from bson import ObjectId
from geolocation import haversine, delivery_fee

router = APIRouter(prefix="/api/cart", tags=["Cart"])


def _date_range(start_date: str, end_date: str):
    try:
        d1 = datetime.strptime(start_date, "%Y-%m-%d")
        d2 = datetime.strptime(end_date, "%Y-%m-%d")
    except (ValueError, TypeError):
        return []
    if d2 < d1:
        return []
    dates = []
    current = d1
    while current <= d2:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


async def _check_availability(db, product_id: str, start_date: str, end_date: str, exclude_item_id: str = None):
    requested = _date_range(start_date, end_date)
    if not requested:
        return

    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    unavailable = set(product.get("unavailable_dates") or [])
    for d in requested:
        if d in unavailable:
            raise HTTPException(status_code=409, detail=f"La fecha {d} no está disponible para este producto")

    query = {
        "product_id": product_id,
        "status": {"$nin": ["cancelada", "rechazada"]},
        "$or": [
            {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}},
        ],
    }
    if exclude_item_id:
        query["id"] = {"$ne": exclude_item_id}

    existing = await db.orders.find_one(query)
    if existing:
        raise HTTPException(status_code=409, detail="El producto ya tiene una reserva en esas fechas")


def _calculate_delivery_fee(product: dict, delivery_method: str, delivery_lat, delivery_lng):
    if delivery_method != "dropoff":
        return 0.0, 0.0
    p_lat = product.get("lat")
    p_lng = product.get("lng")
    if not p_lat or not p_lng or not delivery_lat or not delivery_lng:
        return 0.0, 0.0
    distance = haversine(p_lat, p_lng, delivery_lat, delivery_lng)
    fee = delivery_fee(distance)
    return fee, round(distance, 2)


@router.get("/")
async def get_cart(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    cart = await db.carts.find_one({"user_id": user.id}, {"_id": 0})
    if not cart:
        return {"items": [], "total_mxn": 0, "platform_fee_mxn": 0, "delivery_fee_mxn": 0, "grand_total_mxn": 0}
    items = cart.get("items", [])
    subtotal = sum(i.get("subtotal_mxn", 0) for i in items)
    delivery = sum(i.get("delivery_fee_mxn", 0) for i in items)
    deposit = sum(i.get("deposit_mxn", 0) for i in items)
    fee = round(subtotal * 0.05, 2)
    grand_total = subtotal + deposit + fee + delivery
    return {
        "items": items,
        "total_mxn": round(subtotal, 2),
        "deposit_mxn": round(deposit, 2),
        "platform_fee_mxn": fee,
        "delivery_fee_mxn": round(delivery, 2),
        "grand_total_mxn": round(grand_total, 2),
    }


@router.post("/items")
async def add_to_cart(payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    product_id = payload.get("product_id")
    quantity = payload.get("quantity", 1)
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    delivery_method = payload.get("delivery_method", "pickup")
    delivery_address = payload.get("delivery_address", "")
    delivery_lat = payload.get("delivery_lat")
    delivery_lng = payload.get("delivery_lng")

    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    days = 1
    if product["transaction_type"] == "renta" and start_date and end_date:
        await _check_availability(db, product_id, start_date, end_date)
        try:
            d1 = datetime.strptime(start_date, "%Y-%m-%d")
            d2 = datetime.strptime(end_date, "%Y-%m-%d")
            days = max(1, (d2 - d1).days + 1)
        except ValueError:
            pass

    subtotal = product["price_mxn"] * quantity * days
    deposit = (product.get("deposit_mxn") or 0) * quantity if product["transaction_type"] == "renta" else 0
    delivery_fee_mxn, delivery_distance_km = _calculate_delivery_fee(product, delivery_method, delivery_lat, delivery_lng)

    item = {
        "id": f"ci_{ObjectId()}",
        "product_id": product_id,
        "product_title": product["title"],
        "provider_id": product["provider_id"],
        "transaction_type": product["transaction_type"],
        "quantity": quantity,
        "price_mxn": product["price_mxn"],
        "days": days,
        "start_date": start_date,
        "end_date": end_date,
        "delivery_method": delivery_method,
        "delivery_address": delivery_address,
        "delivery_lat": delivery_lat,
        "delivery_lng": delivery_lng,
        "delivery_fee_mxn": delivery_fee_mxn,
        "delivery_distance_km": delivery_distance_km,
        "subtotal_mxn": round(subtotal, 2),
        "deposit_mxn": round(deposit, 2),
        "image_url": product.get("image_url", ""),
    }
    await db.carts.update_one(
        {"user_id": user.id},
        {"$push": {"items": item}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
        upsert=True,
    )
    return item


@router.patch("/items/{item_id}")
async def update_cart_item(item_id: str, payload: dict, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    quantity = payload.get("quantity")
    if quantity is not None and quantity < 1:
        raise HTTPException(status_code=400, detail="Cantidad inválida")

    set_fields = {}
    for k in ["quantity", "start_date", "end_date", "delivery_method", "delivery_address", "delivery_lat", "delivery_lng"]:
        if k in payload:
            set_fields[f"items.$.{k}"] = payload[k]

    if "quantity" in payload or "start_date" in payload or "end_date" in payload or "delivery_method" in payload or "delivery_lat" in payload or "delivery_lng" in payload:
        cart = await db.carts.find_one({"user_id": user.id, "items.id": item_id})
        if not cart:
            raise HTTPException(status_code=404, detail="Item no encontrado")
        item = next((i for i in cart["items"] if i["id"] == item_id), None)
        if item:
            product = await db.products.find_one({"id": item["product_id"]})
            qty = payload.get("quantity", item["quantity"])
            days = item["days"]
            start = payload.get("start_date", item.get("start_date"))
            end = payload.get("end_date", item.get("end_date"))

            if product["transaction_type"] == "renta" and start and end:
                await _check_availability(db, item["product_id"], start, end)
                try:
                    d1 = datetime.strptime(start, "%Y-%m-%d")
                    d2 = datetime.strptime(end, "%Y-%m-%d")
                    days = max(1, (d2 - d1).days + 1)
                except ValueError:
                    pass
                set_fields["items.$.days"] = days
                set_fields["items.$.start_date"] = start
                set_fields["items.$.end_date"] = end

            subtotal = product["price_mxn"] * qty * days
            deposit = (product.get("deposit_mxn") or 0) * qty if product["transaction_type"] == "renta" else 0
            set_fields["items.$.subtotal_mxn"] = round(subtotal, 2)
            set_fields["items.$.deposit_mxn"] = round(deposit, 2)

            delivery_method = payload.get("delivery_method", item.get("delivery_method", "pickup"))
            delivery_lat = payload.get("delivery_lat", item.get("delivery_lat"))
            delivery_lng = payload.get("delivery_lng", item.get("delivery_lng"))
            delivery_fee_mxn, delivery_distance_km = _calculate_delivery_fee(product, delivery_method, delivery_lat, delivery_lng)
            set_fields["items.$.delivery_fee_mxn"] = delivery_fee_mxn
            set_fields["items.$.delivery_distance_km"] = delivery_distance_km

    if not set_fields:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    set_fields["updated_at"] = datetime.utcnow().isoformat()
    await db.carts.update_one({"user_id": user.id, "items.id": item_id}, {"$set": set_fields})
    return {"success": True}


@router.delete("/items/{item_id}")
async def remove_cart_item(item_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await db.carts.update_one(
        {"user_id": user.id},
        {"$pull": {"items": {"id": item_id}}, "$set": {"updated_at": datetime.utcnow().isoformat()}},
    )
    return {"success": True}


@router.post("/checkout")
async def checkout_cart(payload: dict = None, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    user_doc = await db.users.find_one({"id": user.id})
    if not user_doc or user_doc.get("verification_status") != "verificado":
        raise HTTPException(status_code=403, detail="Usuario no verificado. Completa tu KYC antes de ordenar.")

    cart = await db.carts.find_one({"user_id": user.id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Carrito vacío")

    insurance_enabled = payload.get("insurance_enabled", False) if payload else False
    created_orders = []

    for item in cart["items"]:
        if item.get("transaction_type") == "renta" and item.get("start_date") and item.get("end_date"):
            await _check_availability(db, item["product_id"], item["start_date"], item["end_date"])

    for item in cart["items"]:
        order_id = f"ord_{ObjectId()}"
        subtotal = item["subtotal_mxn"]
        deposit = item["deposit_mxn"]
        fee = round(subtotal * 0.05, 2)
        insurance_fee = 0.0
        insurance_percent = 0.0
        if insurance_enabled and item["transaction_type"] == "renta":
            insurance_percent = 3.0
            insurance_fee = round(subtotal * insurance_percent / 100, 2)

        delivery_fee_mxn = item.get("delivery_fee_mxn", 0)
        booked_dates = _date_range(item.get("start_date"), item.get("end_date")) if item.get("transaction_type") == "renta" else []
        total = subtotal + deposit + fee + insurance_fee + delivery_fee_mxn

        order = {
            "id": order_id,
            "user_id": user.id,
            "provider_id": item["provider_id"],
            "product_id": item["product_id"],
            "product_title": item["product_title"],
            "transaction_type": item["transaction_type"],
            "quantity": item["quantity"],
            "days": item.get("days", 1),
            "start_date": item.get("start_date"),
            "end_date": item.get("end_date"),
            "booked_dates": booked_dates,
            "dates_committed": True,
            "hold_expires_at": None,
            "delivery_address": item.get("delivery_address", ""),
            "delivery_method": item.get("delivery_method", "pickup"),
            "delivery_lat": item.get("delivery_lat"),
            "delivery_lng": item.get("delivery_lng"),
            "delivery_fee_mxn": delivery_fee_mxn,
            "delivery_distance_km": item.get("delivery_distance_km", 0),
            "subtotal_mxn": item["subtotal_mxn"],
            "deposit_mxn": item["deposit_mxn"],
            "platform_fee_mxn": fee,
            "insurance_enabled": insurance_enabled,
            "insurance_fee_mxn": insurance_fee,
            "insurance_percent": insurance_percent,
            "total_mxn": round(total, 2),
            "status": "creada",
            "payment_status": "unpaid",
            "deposit_status": "held",
            "extended_hold": False,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
        await db.orders.insert_one(order)
        created_orders.append({"order_id": order_id, "product_title": item["product_title"], "total_mxn": order["total_mxn"]})

    await db.carts.delete_one({"user_id": user.id})
    return {"success": True, "orders": created_orders}
