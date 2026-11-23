import { apiClient } from './client';
import { KycPendingUser } from '../types/models';

export async function getPendingKyc(): Promise<{ items: KycPendingUser[]; total: number }> {
  return apiClient('/api/auth/kyc/pending');
}

export async function approveKyc(userId: string): Promise<{ success: boolean }> {
  return apiClient(`/api/auth/users/${userId}/verify`, { method: 'POST' });
}

export async function rejectKyc(userId: string): Promise<{ success: boolean }> {
  return apiClient(`/api/auth/users/${userId}/reject`, { method: 'POST' });
}
