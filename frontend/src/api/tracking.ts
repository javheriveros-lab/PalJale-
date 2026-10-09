import { apiClient } from './client';

export async function getTrackingLocation(orderId: string) {
  return apiClient(`/api/orders/${orderId}/location`);
}

export async function updateTrackingLocation(orderId: string, lat: number, lng: number, status?: string) {
  return apiClient(`/api/orders/${orderId}/location`, {
    method: 'PATCH',
    body: JSON.stringify({ lat, lng, status }),
  });
}

export async function startTracking(orderId: string) {
  return apiClient(`/api/orders/${orderId}/location/start`, { method: 'POST' });
}
