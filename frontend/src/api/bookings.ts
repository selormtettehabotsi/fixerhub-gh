import client from './client';

export interface BookingPayload {
  customerId: number;
  workerId: number;
  serviceType: string;
  amount: number;
  minAmount?: number;
  maxAmount?: number;
  notes?: string;
  customerPhone: string;
}

export interface Booking {
  id: number;
  customerId: number;
  workerId: number;
  serviceType: string;
  amount: number;
  minAmount?: number;
  maxAmount?: number;
  notes?: string;
  status: string;
  customerPhone: string;
  createdAt?: string;
}

export async function createBooking(payload: BookingPayload): Promise<Booking> {
  const res = await client.post<Booking>('/bookings', payload);
  return res.data;
}

export async function updateBooking(id: number | string, payload: Partial<BookingPayload>): Promise<Booking> {
  const res = await client.put<Booking>(`/bookings/${id}`, payload);
  return res.data;
}

export async function updateBookingStatus(id: number | string, status: string): Promise<Booking> {
  const res = await client.put<Booking>(`/bookings/${id}/status`, { status });
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
