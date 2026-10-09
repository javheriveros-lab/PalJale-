import { apiClient } from './client';

export interface ConnectStatus {
  stripe_account_id: string | null;
  status: 'active' | 'pending' | 'restricted' | null;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements_due: boolean;
  requirements_currently_due?: string[];
}

export interface ConnectRequirements {
  currently_due: string[];
  eventually_due: string[];
  past_due: string[];
  disabled_reason: string | null;
}

export interface ConnectAccountLink {
  stripe_account_id: string;
  account_link_url: string;
}

export interface PayoutPreview {
  subtotal_mxn: number;
  platform_fee_percent: number;
  platform_fee_mxn: number;
  platform_fee_iva_mxn: number;
  stripe_fee_percent: number;
  stripe_fee_fixed_mxn: number;
  stripe_fee_mxn: number;
  stripe_fee_iva_mxn: number;
  stripe_total_cost_mxn: number;
  is_international_card: boolean;
  provider_net_mxn: number;
  provider_net_percent: number;
}

export function getConnectStatus(): Promise<ConnectStatus> {
  return apiClient('/api/connect/status');
}

export function getConnectRequirements(): Promise<ConnectRequirements> {
  return apiClient('/api/connect/requirements');
}

export function createConnectAccount(): Promise<ConnectAccountLink> {
  return apiClient('/api/connect/account', {
    method: 'POST',
    body: JSON.stringify({ business_type: 'individual', country: 'MX' }),
  });
}

export function refreshConnectAccountLink(stripe_account_id: string): Promise<ConnectAccountLink> {
  return apiClient('/api/connect/account-link', {
    method: 'POST',
    body: JSON.stringify({ stripe_account_id }),
  });
}

export function previewPayout(amount_mxn: number, is_international_card = false): Promise<PayoutPreview> {
  return apiClient('/api/connect/payout-preview', {
    method: 'POST',
    body: JSON.stringify({ amount_mxn, is_international_card }),
  });
}
