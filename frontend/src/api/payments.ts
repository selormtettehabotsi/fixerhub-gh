import client from './client';

export interface Payment {
  id: number;
  bookingId: number;
  customerId: number;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  workerAmount: number;
  status: string;
  createdAt?: string;
}

export async function getPaymentByBooking(bookingId: number | string): Promise<Payment> {
  const res = await client.get<Payment>(`/payments/booking/${bookingId}`);
  return res.data;
}

export async function getPaymentsByCustomer(customerId: number | string): Promise<Payment[]> {
  const res = await client.get<Payment[]>(`/payments/customer/${customerId}`);
  return res.data;
}
