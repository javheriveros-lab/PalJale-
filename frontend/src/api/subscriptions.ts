import { apiClient } from './client';

export async function createProSubscription() {
  return apiClient('/api/subscriptions/pro', { method: 'POST' });
}

export async function getProStatus() {
  return apiClient('/api/subscriptions/pro/status');
}

export async function cancelProSubscription() {
  return apiClient('/api/subscriptions/pro/cancel', { method: 'POST' });
}

export async function getFeaturedProducts(limit = 10) {
  return apiClient(`/api/subscriptions/featured-products?limit=${limit}`);
}
