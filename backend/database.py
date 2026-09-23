import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")
if not MONGO_URL:
    raise RuntimeError(
        "MONGO_URL (o MONGODB_URI) no está configurada. "
        "Defínela en las variables de entorno de Railway apuntando a tu cluster de MongoDB Atlas "
        "(ej. mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority)."
    )

DB_NAME = os.getenv("DB_NAME", "paljale")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def get_db():
    return db

INDEXES = [
    ("users", "email", {"unique": True}),
    ("users", "is_pro", {}),
    ("products", "provider_id", {}),
    ("orders", "user_id", {}),
    ("orders", "provider_id", {}),
    ("notifications", [("user_id", 1), ("created_at", -1)], {}),
    ("notifications", [("user_id", 1), ("read", 1)], {}),
    ("settings", "key", {"unique": True}),
    ("bank_configs", "id", {"unique": True}),
    ("commission_payouts", "id", {"unique": True}),
    ("chat_messages", [("order_id", 1), ("created_at", -1)], {}),
    ("push_tokens", [("user_id", 1), ("token", 1)], {"unique": True}),
    ("reviews", [("order_id", 1), ("type", 1)], {"unique": True}),
    ("reviews", "product_id", {}),
    ("reviews", "reviewee_id", {}),
    ("carts", "user_id", {"unique": True}),
    ("products", [("category", 1), ("transaction_type", 1)], {}),
    ("products", [("lat", 1), ("lng", 1)], {}),
    ("chat_messages", [("order_id", 1), ("receiver_id", 1), ("read_at", 1)], {}),
]

async def init_indexes():
    for collection, spec, kwargs in INDEXES:
        try:
            await db[collection].create_index(spec, **kwargs)
        except Exception:
            logger.exception("Fallo creando índice %s en la colección '%s'", spec, collection)
            raise
