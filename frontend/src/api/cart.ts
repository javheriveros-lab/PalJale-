import { apiClient } from './client';

export interface CartItem {
  id: string;
  product_id: string;
  product_title: string;
  provider_id: string;
  transaction_type: 'venta' | 'renta';
  quantity: number;
  price_mxn: number;
  days: number;
  start_date?: string | null;
  end_date?: string | null;
  delivery_method: 'pickup' | 'dropoff';
  delivery_address?: string;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  subtotal_mxn: number;
  deposit_mxn: number;
  image_url: string;
}

export interface Cart {
  items: CartItem[];
  total_mxn: number;
  platform_fee_mxn: number;
  grand_total_mxn: number;
}

export interface AddToCartPayload {
  product_id: string;
  quantity?: number;
  start_date?: string;
  end_date?: string;
  delivery_method?: 'pickup' | 'dropoff';
  delivery_address?: string;
  delivery_lat?: number;
  delivery_lng?: number;
}

export function getCart(): Promise<Cart> {
  return apiClient('/api/cart/');
}

export function addToCart(payload: AddToCartPayload): Promise<CartItem> {
  return apiClient('/api/cart/items', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateCartItem(itemId: string, payload: Partial<AddToCartPayload>): Promise<{ success: boolean }> {
  return apiClient(`/api/cart/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function removeCartItem(itemId: string): Promise<{ success: boolean }> {
  return apiClient(`/api/cart/items/${itemId}`, { method: 'DELETE' });
}

export interface CheckoutCartResult {
  success: boolean;
  orders: { order_id: string; product_title: string; total_mxn: number }[];
  checkout_url: string;
  session_id: string;
}

export function checkoutCart(insuranceEnabled = false): Promise<CheckoutCartResult> {
  return apiClient('/api/cart/checkout', { method: 'POST', body: JSON.stringify({ insurance_enabled: insuranceEnabled }) });
}
