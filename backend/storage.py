import os
import base64
import uuid
import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, HTTPException
from auth_utils import get_current_user, UserContext

AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
CDN_BASE_URL = os.getenv("CDN_BASE_URL")

s3_client = boto3.client("s3", aws_access_key_id=AWS_ACCESS_KEY, aws_secret_access_key=AWS_SECRET_KEY, region_name=AWS_REGION)
router = APIRouter(prefix="/api/storage", tags=["Storage"])

def _get_public_url(key: str) -> str:
    if CDN_BASE_URL:
        return f"{CDN_BASE_URL}/{key}"
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

def upload_bytes_to_s3(data: bytes, key: str, content_type: str = "image/jpeg") -> str:
    try:
        s3_client.put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type, ACL="public-read")
        return _get_public_url(key)
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 upload error: {str(e)}")

def upload_base64_to_s3(b64_data: str, folder: str, ext: str = "jpg") -> str:
    try:
        header, encoded = b64_data.split(",", 1) if "," in b64_data else ("", b64_data)
        data = base64.b64decode(encoded)
        content_type = "image/jpeg"
        if "png" in header: content_type = "image/png"
        elif "svg" in header: content_type = "image/svg+xml"
        elif "webp" in header: content_type = "image/webp"
        key = f"{folder}/{uuid.uuid4()}.{ext}"
        return upload_bytes_to_s3(data, key, content_type)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 data: {str(e)}")

def generate_presigned_upload_url(key: str, content_type: str, expires: int = 300) -> dict:
    try:
        url = s3_client.generate_presigned_url("put_object", Params={"Bucket": S3_BUCKET, "Key": key, "ContentType": content_type, "ACL": "public-read"}, ExpiresIn=expires)
        return {"signed_url": url, "public_url": _get_public_url(key), "key": key}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"Presigned URL error: {str(e)}")

@router.post("/presigned-upload")
async def presigned_upload(payload: dict, user: UserContext = Depends(get_current_user)):
    filename = payload.get("filename", "file.jpg")
    content_type = payload.get("content_type", "image/jpeg")
    folder = payload.get("folder", "uploads")
    ext = filename.split(".")[-1] if "." in filename else "jpg"
    key = f"{folder}/{user.id}/{uuid.uuid4()}.{ext}"
    return generate_presigned_upload_url(key, content_type)
