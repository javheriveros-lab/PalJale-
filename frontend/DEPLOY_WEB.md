# Deploy de la versión web de Pal Jale

La web reusa el mismo código Expo/React Native del móvil (export estático vía
`react-native-web`), servida como un **segundo servicio independiente** en
Railway — el backend (`pal-jale/backend`) sigue siendo su propio servicio en
`api.paljale.mx`; esto solo agrega uno nuevo para `paljale.mx`.

## Pasos en Railway

1. En el mismo proyecto de Railway donde ya está el backend, **New Service →
   Deploy from GitHub repo**, seleccionando este mismo repo.
2. En **Settings → Build**, pon el **Root Directory** en `frontend` y deja el
   campo **Dockerfile Path vacío** — Railway detecta automáticamente el
   archivo `Dockerfile` dentro de esa carpeta sin necesidad de especificar
   ninguna ruta (evita por completo la ambigüedad de rutas relativas vs.
   absolutas que causó varios intentos fallidos al usar `Dockerfile.web`
   como nombre no estándar).
3. **Variables de entorno** del nuevo servicio:
   - `EXPO_PUBLIC_BACKEND_URL=https://api.paljale.mx`
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...` (la clave publicable de
     Stripe en modo producción; nunca la clave secreta aquí).
   Estas se usan como build args (`ARG`) en `Dockerfile`, así que deben
   estar configuradas **antes** del primer deploy — un export estático ya
   generado no lee variables de entorno en runtime.
4. **Dominio personalizado**: en Settings → Domains, agrega `paljale.mx`
   (y opcionalmente `www.paljale.mx`) y configura el DNS según indique
   Railway. El backend ya tiene `FRONTEND_URL=https://paljale.mx` y CORS
   configurado para ese dominio, así que no requiere cambios adicionales.

## Verificación local antes de desplegar

```bash
cd frontend
EXPO_PUBLIC_BACKEND_URL=https://api.paljale.mx npx expo export -p web
npx serve dist
```

Abre `http://localhost:3000` (o el puerto que indique `serve`) y confirma:
login, catálogo, carrito (abre Stripe Checkout en pestaña nueva), y que las
pantallas de mapa muestren su versión de lista/texto en vez de romperse.

## Notas

- Cada redeploy regenera el export estático completo — no hay actualización
  incremental; es el comportamiento esperado de un sitio estático.
- `@stripe/stripe-react-native` y la gestión de tarjetas guardadas no están
  disponibles en web (ver `src/components/PaymentMethodsScreen.web.tsx`); los
  pagos en web usan Stripe Checkout hospedado, igual que suscripciones y
  Stripe Connect.
