/**
 * Format a Customer or Admin user ID.
 * IDs start visually at 1,000,001 — e.g. DB id=1 → "#1000001"
 */
export function formatUserId(id: string | number | null | undefined): string {
  if (id == null || id === '') return '—';
  return `#${1000000 + Number(id)}`;
}

/**
 * Format a Worker ID.
 * IDs start visually at 5,000,001 — e.g. DB id=1 → "#5000001"
 */
export function formatWorkerId(id: string | number | null | undefined): string {
  if (id == null || id === '') return '—';
  return `#${5000000 + Number(id)}`;
}

/**
 * Format a booking's system ID as an 8-digit zero-padded reference.
 * e.g. booking id=42 → "#00000042"
 */
export function formatBookingId(id: string | number | null | undefined): string {
  if (id == null || id === '') return '—';
  return `#${String(id).padStart(8, '0')}`;
}

/**
 * Build the persistent conversation ID for a customer↔worker pair.
 * This is used as the WebSocket room key so chat history spans across bookings.
 */
export function conversationId(customerId: string | number, workerId: string | number): string {
  return `c${customerId}_w${workerId}`;
}
