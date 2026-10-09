import { apiClient } from './client';

export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_email: string;
  sender_role: string;
  receiver_id: string;
  content: string;
  template_key?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface ConversationSummary {
  order_id: string;
  other_user_id: string;
  other_user_email?: string;
  other_user_name?: string;
  last_message?: string;
  last_message_at?: string;
  unread_count: number;
}

export const CHAT_TEMPLATES = {
  en_camino: '🚛 Voy en camino con el equipo.',
  llegue_punto: '📍 Ya llegué al punto de entrega.',
  demora_10min: '⏱️ Tendré una demora de 10 minutos.',
  equipo_listo: '✅ El equipo está listo para recogerse.',
  gracias: '🙏 Gracias por usar Pal Jale.',
} as const;

export type ChatTemplateKey = keyof typeof CHAT_TEMPLATES;

export function getChatMessages(orderId: string): Promise<{ items: ChatMessage[] }> {
  return apiClient(`/api/chat/orders/${orderId}/messages`);
}

export function sendChatMessage(orderId: string, content: string): Promise<ChatMessage> {
  return apiClient(`/api/chat/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function sendChatTemplate(orderId: string, templateKey: ChatTemplateKey): Promise<ChatMessage> {
  return apiClient(`/api/chat/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ template_key: templateKey }),
  });
}

export function markChatAsRead(orderId: string): Promise<{ success: boolean; marked_count: number }> {
  return apiClient(`/api/chat/orders/${orderId}/read`, { method: 'POST' });
}

export function listConversations(): Promise<{ items: ConversationSummary[] }> {
  return apiClient('/api/chat/conversations');
}
