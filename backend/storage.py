import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions
from auth_utils import get_current_user, UserContext

IMAGEKIT_PRIVATE_KEY = os.getenv("IMAGEKIT_PRIVATE_KEY")
IMAGEKIT_PUBLIC_KEY = os.getenv("IMAGEKIT_PUBLIC_KEY")
IMAGEKIT_URL_ENDPOINT = os.getenv("IMAGEKIT_URL_ENDPOINT")
if not IMAGEKIT_PRIVATE_KEY or not IMAGEKIT_URL_ENDPOINT:
    raise RuntimeError(
        "IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT no están configuradas. "
        "Tómalas del dashboard de ImageKit (Developer options) y agrégalas en las "
        "variables de entorno del servicio."
    )

imagekit = ImageKit(
    private_key=IMAGEKIT_PRIVATE_KEY,
    public_key=IMAGEKIT_PUBLIC_KEY,
    url_endpoint=IMAGEKIT_URL_ENDPOINT,
)
router = APIRouter(prefix="/api/storage", tags=["Storage"])


def upload_base64_image(b64_data: str, folder: str, ext: str = "jpg") -> str:
    """Sube una imagen (string base64, con o sin el prefijo data:...;base64,)
    a ImageKit y regresa su URL pública."""
    try:
        _, encoded = b64_data.split(",", 1) if "," in b64_data else ("", b64_data)
        file_name = f"{uuid.uuid4()}.{ext}"
        result = imagekit.upload_file(
            file=encoded,
            file_name=file_name,
            options=UploadFileRequestOptions(folder=folder, use_unique_file_name=True),
        )
        if not result or not result.url:
            raise HTTPException(status_code=500, detail="ImageKit no devolvió una URL de archivo")
        return result.url
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al subir imagen a ImageKit: {str(e)}")


@router.post("/upload")
async def upload_image(payload: dict, user: UserContext = Depends(get_current_user)):
    """Recibe una imagen en base64 (campo file_base64) y la sube a ImageKit.
    Reemplaza el flujo anterior de presigned-upload directo a S3 — todo pasa
    por el backend, así no hace falta configurar CORS en el proveedor de
    almacenamiento."""
    file_base64 = payload.get("file_base64", "")
    if not file_base64:
        raise HTTPException(status_code=400, detail="file_base64 es requerido")
    filename = payload.get("filename", "file.jpg")
    folder = payload.get("folder", "uploads")
    ext = filename.split(".")[-1] if "." in filename else "jpg"
    url = upload_base64_image(file_base64, f"{folder}/{user.id}", ext)
    return {"url": url}
