# Deploy del backend de Pal Jale

## Opción recomendada: Railway + MongoDB Atlas

Railway es la opción más sencilla para un MVP: deploy automático desde GitHub, escalado simple y precio razonable. MongoDB Atlas ofrece un cluster gratis (512 MB) suficiente para comenzar.

### Pasos en Railway

1. **Crear repo en GitHub** (privado) y subir la carpeta `pal-jale` (sin `frontend/` si tiene su propio repo).
2. **Crear cuenta en** https://railway.app
3. **Nuevo proyecto → Deploy from GitHub repo** y seleccionar el repo.
4. Railway detectará automáticamente `railway.json` y `backend/Dockerfile`.
5. **Variables de entorno** en Railway Dashboard → Variables, agregar todas las del `.env.example`.
6. **Base de datos MongoDB**: usa MongoDB Atlas gratis (https://www.mongodb.com/atlas) o el addon de MongoDB en Railway.
7. **Seed inicial**: una vez deployado, abre una consola en Railway y ejecuta:
   ```bash
   python scripts/seed.py
   ```
8. **Dominio personalizado**: en Railway Dashboard → Settings → Domains, agrega `api.paljale.mx` y configura el CNAME en tu DNS.

### Checklist si el servicio crashea con `ServerSelectionTimeoutError: localhost:27017`

Este error significa que `MONGO_URL` no llegó como variable de entorno al proceso — el código ya no cae en un default de `localhost` en silencio, así que si esto ocurre revisa:

- Que `MONGO_URL` (o `MONGODB_URI`, ambos nombres son aceptados) esté seteada en **Service → Variables** del servicio correcto, no solo a nivel de proyecto compartido.
- Que no sea una "reference variable" (`${{...}}`) que quedó sin resolver.
- Que la URI tenga el formato `mongodb+srv://usuario:password@cluster.mongodb.net/?retryWrites=true&w=majority`, con el password URL-encoded si tiene caracteres especiales (`@`, `:`, `/`, etc.).
- Qué rama y repo de GitHub está conectado al servicio en Railway (Settings → Source) — confirma que es la rama `main`.

### MongoDB Atlas (gratis)

1. Crear cluster M0 gratis.
2. Database Access → crear usuario con contraseña.
3. Network Access → agregar `0.0.0.0/0` (o las IPs de Railway).
4. Copiar la connection string y usarla como `MONGO_URL`.

---

## Deploy manual (cualquier VPS con Docker)

### Requisitos

- Python 3.11+
- MongoDB 5.0+ (local, Atlas o similar)
- Variables de entorno configuradas en `.env`

### 1. Instalación

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
- `STRIPE_CONNECT_WEBHOOK_SECRET` — secreto del webhook de Stripe Connect (`/api/connect/webhook`), se genera en Stripe Dashboard → Developers → Webhooks → Add endpoint, suscrito al evento `account.updated`. Sin esta variable el webhook de Connect responde 500.
- `STRIPE_PRO_PRICE_ID`
- `BANK_DATA_ENCRYPTION_KEY` — clave Fernet para cifrar el número de cuenta bancaria de la plataforma en reposo. Generar con `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` y guardar en un gestor de secretos.
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

### Docker local (opcional)

```bash
cd backend
docker build -t paljale-backend .
docker run -p 8000:8000 --env-file .env paljale-backend
```

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

## 8. Health check y keep-alive

- `GET /api/health` — health check real (además de confirmar que el proceso responde, hace ping a MongoDB). Devuelve `200` con `{"status":"ok","database":"ok"}` si todo está bien, o `503` con `"database":"unreachable"` si Mongo no responde. Úsalo como healthcheck path del servicio en Railway (Settings → Deploy → Healthcheck Path) en vez de `/api/`.
- `.github/workflows/keep-alive.yml` — pinguea el backend (`/api/health`) y la web cada 10 minutos para evitar que se marquen como inactivos. Los defaults apuntan a los dominios de Railway (`paljale-production.up.railway.app` / `caring-miracle-production-4a1b.up.railway.app`); cuando los dominios personalizados (`api.paljale.mx` / `paljale.mx`) estén resolviendo en DNS, configura las variables del repo `BACKEND_HEALTH_URL` y `WEB_URL` en GitHub → Settings → Secrets and variables → Actions → Variables para que el workflow los use sin tocar el YAML.
