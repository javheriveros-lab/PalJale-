from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from database import get_db
from auth_utils import get_current_user, UserContext
from bson import ObjectId

router = APIRouter(prefix="/api/cart", tags=["Cart"])

@router.get("/")
async def get_cart(user: UserContext = Depends(get_current_user)):
    db = await get_db()
    cart = await db.carts.find_one({"user_id": user.id}, {"_id": 0})
    if not cart:
        return {"items": [], "total_mxn": 0, "platform_fee_mxn": 0, "grand_total_mxn": 0}
    items = cart.get("items", [])
    total = sum(i.get("subtotal_mxn", 0) for i in items)
    fee = round(total * 0.05, 2)
    return {"items": items, "total_mxn": round(total, 2), "platform_fee_mxn": fee, "grand_total_mxn": round(total + fee, 2)}

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
        try:
            d1 = datetime.strptime(start_date, "%Y-%m-%d")
            d2 = datetime.strptime(end_date, "%Y-%m-%d")
            days = max(1, (d2 - d1).days + 1)
        except ValueError:
            pass
    subtotal = product["price_mxn"] * quantity * days
    deposit = (product.get("deposit_mxn") or 0) * quantity if product["transaction_type"] == "renta" else 0
    item = {"id": f"ci_{ObjectId()}", "product_id": product_id, "product_title": product["title"], "provider_id": product["provider_id"], "transaction_type": product["transaction_type"], "quantity": quantity, "price_mxn": product["price_mxn"], "days": days, "start_date": start_date, "end_date": end_date, "delivery_method": delivery_method, "delivery_address": delivery_address, "delivery_lat": delivery_lat, "delivery_lng": delivery_lng, "subtotal_mxn": round(subtotal, 2), "deposit_mxn": round(deposit, 2), "image_url": product.get("image_url", "")}
    await db.carts.update_one({"user_id": user.id}, {"$push": {"items": item}, "$set": {"updated_at": datetime.utcnow().isoformat()}}, upsert=True)
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
    if "quantity" in payload or "start_date" in payload or "end_date" in payload:
        cart = await db.carts.find_one({"user_id": user.id, "items.id": item_id})
        if not cart:
            raise HTTPException(status_code=404, detail="Item no encontrado")
        item = next((i for i in cart["items"] if i["id"] == item_id), None)
        if item:
            product = await db.products.find_one({"id": item["product_id"]})
            qty = payload.get("quantity", item["quantity"])
            days = item["days"]
            if "start_date" in payload and "end_date" in payload:
                try:
                    d1 = datetime.strptime(payload["start_date"], "%Y-%m-%d")
                    d2 = datetime.strptime(payload["end_date"], "%Y-%m-%d")
                    days = max(1, (d2 - d1).days + 1)
                except ValueError:
                    pass
                set_fields["items.$.days"] = days
                set_fields["items.$.start_date"] = payload["start_date"]
                set_fields["items.$.end_date"] = payload["end_date"]
            subtotal = product["price_mxn"] * qty * days
            deposit = (product.get("deposit_mxn") or 0) * qty if product["transaction_type"] == "renta" else 0
            set_fields["items.$.subtotal_mxn"] = round(subtotal, 2)
            set_fields["items.$.deposit_mxn"] = round(deposit, 2)
    if not set_fields:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    set_fields["updated_at"] = datetime.utcnow().isoformat()
    await db.carts.update_one({"user_id": user.id, "items.id": item_id}, {"$set": set_fields})
    return {"success": True}

@router.delete("/items/{item_id}")
async def remove_cart_item(item_id: str, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    await db.carts.update_one({"user_id": user.id}, {"$pull": {"items": {"id": item_id}}, "$set": {"updated_at": datetime.utcnow().isoformat()}})
    return {"success": True}

@router.post("/checkout")
async def checkout_cart(payload: dict = None, user: UserContext = Depends(get_current_user)):
    db = await get_db()
    cart = await db.carts.find_one({"user_id": user.id})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Carrito vacío")
    insurance_enabled = payload.get("insurance_enabled", False) if payload else False
    created_orders = []
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
        total = subtotal + deposit + fee + insurance_fee
        order = {"id": order_id, "user_id": user.id, "provider_id": item["provider_id"], "product_id": item["product_id"], "product_title": item["product_title"], "transaction_type": item["transaction_type"], "start_date": item.get("start_date"), "end_date": item.get("end_date"), "booked_dates": [], "dates_committed": False, "hold_expires_at": None, "delivery_address": item.get("delivery_address", ""), "delivery_method": item.get("delivery_method", "pickup"), "delivery_lat": item.get("delivery_lat"), "delivery_lng": item.get("delivery_lng"), "subtotal_mxn": item["subtotal_mxn"], "deposit_mxn": item["deposit_mxn"], "platform_fee_mxn": fee, "insurance_enabled": insurance_enabled, "insurance_fee_mxn": insurance_fee, "insurance_percent": insurance_percent, "total_mxn": round(total, 2), "status": "creada", "payment_status": "unpaid", "deposit_status": "held", "extended_hold": False, "created_at": datetime.utcnow().isoformat(), "updated_at": datetime.utcnow().isoformat()}
        await db.orders.insert_one(order)
        created_orders.append({"order_id": order_id, "product_title": item["product_title"], "total_mxn": order["total_mxn"]})
    await db.carts.delete_one({"user_id": user.id})
    return {"success": True, "orders": created_orders}
