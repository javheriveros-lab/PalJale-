import { getItem } from '../utils/tokenStorage';

function sanitizeBackendUrl(raw: string): string {
  // Protege contra el env var pegado en formato markdown, ej.
  // "[https://host](https://host)" en vez de "https://host" — si no se
  // limpia, fetch resuelve una URL relativa contra el propio dominio del
  // frontend y el servidor devuelve el index.html (200, HTML) en vez del
  // JSON del backend, lo cual rompe res.json() con un error confuso.
  const match = raw.trim().match(/^\[(https?:\/\/[^\]]+)\]\(https?:\/\/[^)]+\)$/);
  return (match ? match[1] : raw.trim()).replace(/\/+$/, '');
}

const BACKEND_URL = sanitizeBackendUrl(process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000');

if (!/^https?:\/\//.test(BACKEND_URL)) {
  console.error(`EXPO_PUBLIC_BACKEND_URL inválida: "${BACKEND_URL}". Debe ser una URL absoluta (https://...).`);
}

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
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err) {
    console.error(`Fallo de red al llamar ${url}:`, err);
    throw new Error('No se pudo conectar con el servidor. Verifica tu conexión.');
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch (err) {
    console.error(`Respuesta no-JSON de ${url}:`, err);
    throw new Error('El servidor respondió en un formato inesperado. Verifica la URL del backend configurada.');
  }
}
