import { apiClient } from './client';

export interface SetupIntentResponse {
  client_secret: string;
  stripe_customer_id: string;
}

export interface PaymentMethodCard {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
}

export interface CheckoutSession {
  url: string;
  session_id: string;
}

export function createSetupIntent(): Promise<SetupIntentResponse> {
  return apiClient('/api/payments/setup-intent', { method: 'POST' });
}

export function listPaymentMethods(): Promise<{ items: PaymentMethodCard[] }> {
  return apiClient('/api/payments/payment-methods');
}

export function deletePaymentMethod(pmId: string): Promise<{ success: boolean }> {
  return apiClient(`/api/payments/payment-methods/${pmId}`, { method: 'DELETE' });
}

export function createOrderCheckoutSession(orderId: string): Promise<CheckoutSession> {
  return apiClient('/api/payments/checkout-session', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId }),
  });
}

export interface PaymentMethodsSummary {
  count: number;
  cards: { brand: string; last4: string }[];
}

// Vista de solo lectura para soporte/admin: nunca expone IDs de Stripe ni permite borrar.
export function getUserPaymentMethodsSummary(userId: string): Promise<PaymentMethodsSummary> {
  return apiClient(`/api/payments/admin/users/${userId}/payment-methods-summary`);
}
