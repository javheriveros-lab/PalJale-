import { getItem } from '../utils/tokenStorage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function getToken(): Promise<string | null> {
  return await getItem('jwt_token');
}

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const token = await getToken();
  const url = `${BACKEND_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Error desconocido' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
