import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "paljale")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def get_db():
    return db

async def init_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("is_pro")
    await db.products.create_index("provider_id")
    await db.orders.create_index("user_id")
    await db.orders.create_index("provider_id")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.settings.create_index("key", unique=True)
    await db.bank_configs.create_index("id", unique=True)
    await db.commission_payouts.create_index("id", unique=True)
    await db.chat_messages.create_index([("order_id", 1), ("created_at", -1)])
    await db.push_tokens.create_index([("user_id", 1), ("token", 1)], unique=True)
    await db.reviews.create_index([("order_id", 1), ("type", 1)], unique=True)
    await db.carts.create_index("user_id", unique=True)
