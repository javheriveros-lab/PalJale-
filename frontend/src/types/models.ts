export type Role = 'cliente' | 'proveedor' | 'profesional' | 'admin';
export type VerificationStatus = 'pendiente' | 'en_revision' | 'verificado' | 'rechazada';
export type Category = 'maquinaria' | 'herramientas' | 'materiales' | 'personal';
export type TransactionType = 'venta' | 'renta';
export type OrderStatus = 'creada' | 'aceptada' | 'rechazada' | 'pickup_listo' | 'en_transito' | 'entregada' | 'devuelta' | 'cancelada';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded' | 'failed';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  verification_status: VerificationStatus;
  stripe_customer_id?: string | null;
  stripe_connect_account_id?: string | null;
  stripe_connect_status?: 'pending' | 'active' | 'restricted' | null;
  stripe_connect_charges_enabled?: boolean;
  stripe_connect_payouts_enabled?: boolean;
  default_payment_method_id?: string | null;
  is_pro?: boolean;
  pro_status?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  category: Category;
  transaction_type: TransactionType;
  price_mxn: number;
  deposit_mxn?: number | null;
  image_url: string;
  provider_id: string;
  lat?: number | null;
  lng?: number | null;
  rating: number;
  unavailable_dates: string[];
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  provider_id: string;
  product_id: string;
  product_title: string;
  transaction_type: TransactionType;
  start_date?: string | null;
  end_date?: string | null;
  delivery_address: string;
  delivery_method: 'pickup' | 'dropoff';
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  subtotal_mxn: number;
  deposit_mxn: number;
  platform_fee_mxn: number;
  insurance_enabled?: boolean;
  insurance_fee_mxn?: number;
  delivery_fee_mxn?: number;
  delivery_distance_km?: number;
  total_mxn: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: Role;
  content: string;
  template_key?: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  product_id: string;
  rating: number;
  comment: string;
  type: 'buyer_to_provider' | 'provider_to_buyer';
  created_at: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_title: string;
  provider_id: string;
  transaction_type: TransactionType;
  quantity: number;
  price_mxn: number;
  days: number;
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
