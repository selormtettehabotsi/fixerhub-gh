import client from './client';

/** NOTIFICATION CENTER: in-app notification history (stored by auth-service). */

export interface AppNotification {
  id: number;
  userId: number;
  title: string;
  body: string;
  /** BOOKING | PAYMENT | QUOTE | SYSTEM */
  type: string;
  bookingId?: number | null;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(page = 0, size = 30): Promise<AppNotification[]> {
  const res = await client.get<AppNotification[]>(`/auth/notifications?page=${page}&size=${size}`);
  return res.data;
}

export async function getNotificationUnreadCount(): Promise<number> {
  const res = await client.get<{ unread: number }>('/auth/notifications/unread-count');
  return res.data?.unread ?? 0;
}

export async function markNotificationRead(id: number): Promise<void> {
  await client.put(`/auth/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.put('/auth/notifications/read-all');
}
