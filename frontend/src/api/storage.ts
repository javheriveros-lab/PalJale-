import { apiClient } from './client';

export async function getPresignedUploadUrl(filename: string, contentType: string, folder: string) {
  return apiClient('/api/storage/presigned-upload', {
    method: 'POST',
    body: JSON.stringify({ filename, content_type: contentType, folder }),
  });
}

export async function uploadFileToS3(file: File | Blob, signedUrl: string): Promise<void> {
  const res = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': (file as any).type || 'image/jpeg' },
    body: file,
  });
  if (!res.ok) throw new Error('Error al subir archivo a S3');
}
