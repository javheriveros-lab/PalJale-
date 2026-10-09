# Pal Jale — Web (export estático de Expo), servido como su propio servicio
# (ej. en Railway, apuntando el dominio paljale.mx aquí y api.paljale.mx al
# backend de pal-jale/backend). No comparte Dockerfile con el backend.
#
# El contexto de build que usa Railway para este servicio es la RAÍZ del
# repo (no "frontend/"), pese a que "Root Directory" esté puesto en
# frontend en el dashboard — por eso todas las rutas de COPY llevan el
# prefijo frontend/ explícito.

FROM public.ecr.aws/docker/library/node:20-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
ARG EXPO_PUBLIC_BACKEND_URL
ARG EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV EXPO_PUBLIC_BACKEND_URL=${EXPO_PUBLIC_BACKEND_URL}
ENV EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}
RUN npx expo export -p web

FROM public.ecr.aws/docker/library/node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 8000
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8000}"]
