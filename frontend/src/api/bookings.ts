import client from './client';

export interface BookingPayload {
  customerId: number;
  workerId: number;
  workerName?: string;
  serviceType: string;
  /** AGREED PRICE: no longer sent at creation — the worker confirms the final
   *  amount when completing the job (see updateBookingStatus finalAmount). */
  amount?: number;
  minAmount?: number;
  maxAmount?: number;
  notes?: string;
  customerPhone: string;
  /** JOB LOCATION: customer's GPS at booking time — lets the worker navigate to the job. */
  customerLat?: number | null;
  customerLng?: number | null;
  bookingImage?: string;
  bookingImages?: string[];
  pricingStyle?: string;
  /** RETENTION: NONE | WEEKLY | BIWEEKLY | MONTHLY */
  recurrence?: string;
  /** SCHEDULING: "YYYY-MM-DDTHH:mm:ss" — when the customer wants the worker to come. */
  scheduledAt?: string;
}

export interface Booking {
  id: number;
  customerId: number;
  workerId: number;
  workerName?: string;
  serviceType: string;
  amount: number;
  minAmount?: number;
  maxAmount?: number;
  notes?: string;
  status: string;
  customerPhone: string;
  customerLat?: number | null;
  customerLng?: number | null;
  createdAt?: string;
  quotedAmount?: number;
  quoteStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  bookingImage?: string;
  bookingImages?: string[];
  pricingStyle?: string;
  recurrence?: string;
  scheduledAt?: string;
}

/** MILESTONES: completed-jobs count for the worker profile badge. */
export async function getWorkerJobStats(workerId: number | string): Promise<{ completedJobs: number }> {
  const res = await client.get<{ completedJobs: number }>(`/bookings/worker/${workerId}/stats`);
  return res.data;
}

export async function createBooking(payload: BookingPayload): Promise<Booking> {
  const res = await client.post<Booking>('/bookings', payload);
  return res.data;
}

export async function updateBooking(id: number | string, payload: Partial<BookingPayload>): Promise<Booking> {
  const res = await client.put<Booking>(`/bookings/${id}`, payload);
  return res.data;
}

/** Update a booking's status. When completing, pass `finalAmount` — the agreed
 *  price the worker confirms, which becomes exactly what the customer is charged. */
export async function updateBookingStatus(
  id: number | string,
  status: string,
  finalAmount?: number
): Promise<Booking> {
  const body: Record<string, unknown> = { status };
  if (finalAmount != null) body.finalAmount = finalAmount;
  const res = await client.put<Booking>(`/bookings/${id}/status`, body);
  return res.data;
}

export async function getBookingsByCustomer(customerId: number | string): Promise<Booking[]> {
  const res = await client.get<Booking[]>(`/bookings/customer/${customerId}`);
  return res.data;
}

export async function getBookingsByWorker(workerId: number | string): Promise<Booking[]> {
  const res = await client.get<Booking[]>(`/bookings/worker/${workerId}`);
  return res.data;
}

export async function getBooking(id: number | string): Promise<Booking> {
  const res = await client.get<Booking>(`/bookings/${id}`);
  return res.data;
}

export async function submitQuote(bookingId: number | string, quotedAmount: number): Promise<Booking> {
  const res = await client.post<Booking>(`/bookings/${bookingId}/quote`, { quotedAmount });
  return res.data;
}

export async function acceptQuote(bookingId: number | string): Promise<Booking> {
  const res = await client.put<Booking>(`/bookings/${bookingId}/quote/accept`);
  return res.data;
}

export async function declineQuote(bookingId: number | string): Promise<Booking> {
  const res = await client.put<Booking>(`/bookings/${bookingId}/quote/decline`);
  return res.data;
}

export async function cancelBooking(id: number | string): Promise<Booking> {
  const res = await client.delete<Booking>(`/bookings/${id}`);
  return res.data;
}