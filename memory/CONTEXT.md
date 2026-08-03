# PAL JALE — CONTEXT.md
# Fuente de verdad para Kimi Code
# Ruta raíz: ~/proyectos/pal-jale/

## Stack
- Backend: Python 3.11 + FastAPI + Motor (async MongoDB)
- Frontend: Expo SDK 50 + React Native + expo-router
- Pagos: Stripe (Payments, Connect, Subscriptions, SetupIntents)
- Storage: AWS S3 (presigned URLs)
- Mapas: react-native-maps + Google Maps API
- PDF: fpdf2

## Reglas de negocio
1. Comisión plataforma: exactamente 5%
2. Seguro opcional: 3% sobre rentas
3. Flete: $150 base + $12/km (Haversine)
4. Imágenes/firmas: S3 URLs, NUNCA base64 en MongoDB
5. Kill Switch: 503 antes de cualquier llamada a Stripe
6. Solo usuarios "verificado" pueden crear órdenes

## Variables .env obligatorias
MONGO_URL, DB_NAME, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRO_PRICE_ID, ADMIN_EMAIL, ADMIN_PASSWORD, AWS_ACCESS_KEY_ID,
AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, CDN_BASE_URL, FRONTEND_URL
