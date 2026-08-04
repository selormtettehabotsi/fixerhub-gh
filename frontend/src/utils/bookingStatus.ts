/**
 * BOOKING STATUS — one place that turns the API's enum into words.
 *
 * The backend's values are shouty constants (WORKER_ON_THE_WAY), which is right
 * for a wire format and wrong for a screen. Two screens already kept their own
 * copy of this map while the customer's booking list rendered the raw value, so
 * the same booking read "On the Way" in one place and "WORKER_ON_THE_WAY" in
 * another. This is that map, once.
 *
 * The fallback matters: if the backend ever adds a status the app doesn't know,
 * we show a readable version of it rather than a blank badge.
 */

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  WORKER_ON_THE_WAY: 'On the Way',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

/** Human-readable label for a booking status. */
export function statusLabel(status?: string | null): string {
  if (!status) return '';
  const known = STATUS_LABELS[status];
  if (known) return known;
  // Unknown status: SOME_NEW_STATE -> "Some New State"
  return status
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
