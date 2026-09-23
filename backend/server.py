import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import init_indexes
import auth
import products
import orders
import payments
import inspections
import kyc
import notifications
import admin_settings
import admin_bank
import connect
import chat
import reviews
import push_service
import provider_metrics
import checklist_signature
import orders_checklist
import storage
import cart
import contracts
import insurance
import subscriptions
import geolocation_routes

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_indexes()
    except Exception:
        logger.exception("Fallo al inicializar índices de MongoDB — el servicio no puede arrancar correctamente")
        raise
    yield

app = FastAPI(title="Pal Jale API", lifespan=lifespan)

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no manejado en %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

# Configuración robusta de CORS para producción y desarrollo
raw_origins = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
frontend_url = os.getenv("FRONTEND_URL", "https://paljale.mx").strip()
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

default_dev_origins = [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://localhost:19006",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8081",
]
for origin in default_dev_origins:
    if origin not in allowed_origins:
        allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(orders_checklist.router)
app.include_router(checklist_signature.router)
app.include_router(storage.router)
app.include_router(payments.router)
app.include_router(inspections.router)
app.include_router(kyc.router)
app.include_router(notifications.router)
app.include_router(admin_settings.router)
app.include_router(admin_bank.router)
app.include_router(connect.router)
app.include_router(chat.router)
app.include_router(reviews.router)
app.include_router(push_service.router)
app.include_router(provider_metrics.router)
app.include_router(cart.router)
app.include_router(contracts.router)
app.include_router(insurance.router)
app.include_router(subscriptions.router)
app.include_router(geolocation_routes.router)

@app.get("/api/")
async def health():
    return {"status": "ok", "service": "pal-jale-api"}

