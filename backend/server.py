from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
import cart
import contracts
import insurance
import subscriptions
import geolocation_routes

app = FastAPI(title="Pal Jale API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await init_indexes()

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(orders.router)
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
app.include_router(checklist_signature.router)
app.include_router(cart.router)
app.include_router(contracts.router)
app.include_router(insurance.router)
app.include_router(subscriptions.router)
app.include_router(geolocation_routes.router)

@app.get("/api/")
async def health():
    return {"status": "ok", "service": "pal-jale-api"}
