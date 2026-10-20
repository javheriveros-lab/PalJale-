import { apiClient } from './client';

export async function uploadImage(fileBase64: string, filename: string, folder: string): Promise<string> {
  const res = await apiClient('/api/storage/upload', {
    method: 'POST',
    body: JSON.stringify({ file_base64: fileBase64, filename, folder }),
  });
  return res.url;
}
