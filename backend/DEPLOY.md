# Deploy del backend de Pal Jale

## Requisitos

- Python 3.11+
- MongoDB 5.0+ (local, Atlas o similar)
- Variables de entorno configuradas en `.env`

## 1. Instalación

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o: .\venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

## 2. Configuración

Copia el archivo de ejemplo y rellena los valores reales:

```bash
cp .env.example .env
```

Variables obligatorias:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `CDN_BASE_URL`
- `FRONTEND_URL`

## 3. Seed inicial

Crea el admin inicial y la configuración global:

```bash
./venv/Scripts/python.exe scripts/seed.py
```

## 4. Ejecutar en desarrollo

```bash
./venv/Scripts/python.exe -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## 5. Ejecutar en producción

```bash
./venv/Scripts/python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --workers 2
```

En producción se recomienda usar un reverse proxy como Nginx o Caddy con HTTPS, y un process manager como systemd, PM2 o Docker.

## 6. Webhooks de Stripe

Configura en el dashboard de Stripe el endpoint:

```
https://api.paljale.mx/api/payments/webhook
```

Con el secreto configurado en `STRIPE_WEBHOOK_SECRET`.

## 7. Notificaciones push (opcional)

Para enviar notificaciones push desde el backend:

- Configura `EXPO_ACCESS_TOKEN` si usas Expo Push Service.
- O configura `GOOGLE_APPLICATION_CREDENTIALS` apuntando a `backend/firebase-admin-sdk.json` si usas Firebase Admin SDK.
