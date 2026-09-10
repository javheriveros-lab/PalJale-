from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
from database import get_db
from auth_utils import require_provider, UserContext

router = APIRouter(prefix="/api/provider/metrics", tags=["Provider Metrics"])

@router.get("/")
async def get_provider_metrics(user: UserContext = Depends(require_provider)):
    db = await get_db()
    provider_id = user.id
    pipeline_income = [{"$match": {"provider_id": provider_id, "payment_status": "paid", "status": {"$in": ["entregada", "devuelta"]}}}, {"$group": {"_id": None, "total_net": {"$sum": {"$ifNull": ["$provider_payout_amount_mxn", {"$subtract": ["$subtotal_mxn", "$platform_fee_mxn"]}]}}}}]
    income_res = await db.orders.aggregate(pipeline_income).to_list(length=1)
    total_net = income_res[0]["total_net"] if income_res else 0.0
    pipeline_status = [{"$match": {"provider_id": provider_id}}, {"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    status_res = await db.orders.aggregate(pipeline_status).to_list(length=20)
    status_breakdown = {r["_id"]: r["count"] for r in status_res}
    pipeline_products = [{"$match": {"provider_id": provider_id, "payment_status": "paid"}}, {"$group": {"_id": "$product_id", "product_title": {"$first": "$product_title"}, "total_revenue": {"$sum": {"$ifNull": ["$provider_payout_amount_mxn", {"$subtract": ["$subtotal_mxn", "$platform_fee_mxn"]}]}}}}, {"$sort": {"total_revenue": -1}}, {"$limit": 5}]
    products_res = await db.orders.aggregate(pipeline_products).to_list(length=5)
    top_products = [{"product_id": r["_id"], "product_title": r["product_title"], "total_revenue": r["total_revenue"]} for r in products_res]
    user_doc = await db.users.find_one({"id": provider_id})
    rating = user_doc.get("rating", 0.0) if user_doc else 0.0
    reviews_count = user_doc.get("reviews_count", 0) if user_doc else 0
    start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    orders_this_month = await db.orders.count_documents({
        "provider_id": provider_id,
        "created_at": {"$gte": start_of_month.isoformat()}
    })
    pipeline_month = [
        {
            "$match": {
                "provider_id": provider_id,
                "payment_status": "paid",
                "status": {"$in": ["entregada", "devuelta"]},
                "$or": [
                    {"paid_at": {"$gte": start_of_month.isoformat()}},
                    {"paid_at": {"$gte": start_of_month}},
                ]
            }
        },
        {
            "$group": {
                "_id": None,
                "total": {
                    "$sum": {
                        "$ifNull": [
                            "$provider_payout_amount_mxn",
                            {"$subtract": ["$subtotal_mxn", "$platform_fee_mxn"]}
                        ]
                    }
                }
            }
        }
    ]
    month_res = await db.orders.aggregate(pipeline_month).to_list(length=1)
    income_this_month = month_res[0]["total"] if month_res else 0.0
    return {
        "total_net_income": round(total_net, 2),
        "income_this_month": round(income_this_month, 2),
        "orders_this_month": orders_this_month,
        "status_breakdown": status_breakdown,
        "top_products": top_products,
        "rating": round(rating, 2),
        "reviews_count": reviews_count
    }

@router.get("/history")
async def get_income_history(months: int = 6, user: UserContext = Depends(require_provider)):
    db = await get_db()
    provider_id = user.id
    now = datetime.utcnow()
    results = []
    for i in range(months):
        month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        pipeline = [
            {
                "$match": {
                    "provider_id": provider_id,
                    "payment_status": "paid",
                    "status": {"$in": ["entregada", "devuelta"]},
                    "$or": [
                        {"paid_at": {"$gte": month_start.isoformat(), "$lt": month_end.isoformat()}},
                        {"paid_at": {"$gte": month_start, "$lt": month_end}},
                    ]
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {
                        "$sum": {
                            "$ifNull": [
                                "$provider_payout_amount_mxn",
                                {"$subtract": ["$subtotal_mxn", "$platform_fee_mxn"]}
                            ]
                        }
                    }
                }
            }
        ]
        res = await db.orders.aggregate(pipeline).to_list(length=1)
        total = res[0]["total"] if res else 0.0
        results.append({"month": month_start.strftime("%Y-%m"), "label": month_start.strftime("%b %Y"), "income": round(total, 2)})
    return {"items": list(reversed(results))}
