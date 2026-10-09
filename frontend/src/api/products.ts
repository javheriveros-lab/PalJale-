import { apiClient } from './client';

export async function getNearbyProducts(params: { lat: number; lng: number; max_km?: number; category?: string; limit?: number }) {
  const qs = new URLSearchParams();
  qs.append('lat', String(params.lat));
  qs.append('lng', String(params.lng));
  if (params.max_km) qs.append('max_km', String(params.max_km));
  if (params.category) qs.append('category', params.category);
  if (params.limit) qs.append('limit', String(params.limit));
  return apiClient(`/api/products/nearby?${qs.toString()}`);
}

export async function calculateDeliveryFee(orderId: string, deliveryLat: number, deliveryLng: number) {
  return apiClient(`/api/orders/${orderId}/delivery-fee`, {
    method: 'POST',
    body: JSON.stringify({ delivery_lat: deliveryLat, delivery_lng: deliveryLng }),
  });
}
