# Pal Jale — Backend Dockerfile
# Compatible con Railway, Render, Fly.io, AWS ECS, etc.

FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema si fueran necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiar e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente
COPY . .

# Puerto por defecto
EXPOSE 8000

# Comando de inicio compatible con variable de entorno PORT en plataformas cloud
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"]
