import { apiClient } from './client';

export async function registerPushToken(token: string, platform: string) {
  return apiClient('/api/push/register', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterPushToken(token: string) {
  return apiClient('/api/push/unregister', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export async function listPushTokens() {
  return apiClient('/api/push/tokens');
}

export async function sendTestPush() {
  return apiClient('/api/push/send-test', { method: 'POST' });
}
