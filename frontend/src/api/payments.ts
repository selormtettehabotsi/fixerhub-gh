import client from './client';

export interface Payment {
  id: number;
  bookingId: number;
  customerId: number;
  workerId?: number;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  workerAmount: number;
  status: string;
  paystackReference?: string;
  paystackStatus?: string;
  authorizationUrl?: string;
  serviceType?: string;
  workerName?: string;
  workerPhone?: string;
  /** "pending" | "success" | "failed" — automated MoMo payout to worker */
  payoutStatus?: string;
  payoutReference?: string;
  createdAt?: string;
}

export interface PaymentUrl {
  authorizationUrl: string;
  reference: string;
}

export interface PaymentVerifyResult {
  status: string;
}

export async function getPaymentByBooking(bookingId: number | string): Promise<Payment> {
  const res = await client.get<Payment>(`/payments/booking/${bookingId}`);
  return res.data;
}

export async function getPaymentUrl(bookingId: number | string): Promise<PaymentUrl> {
  const res = await client.get<PaymentUrl>(`/payments/booking/${bookingId}/pay-url`);
  return res.data;
}

export async function verifyPayment(bookingId: number | string): Promise<PaymentVerifyResult> {
  const res = await client.post<PaymentVerifyResult>(`/payments/booking/${bookingId}/verify`);
  return res.data;
}

export async function getPaymentsByCustomer(customerId: number | string): Promise<Payment[]> {
  const res = await client.get<Payment[]>(`/payments/customer/${customerId}`);
  return res.data;
}

export interface WorkerPaymentSummary {
  totalEarned: number;
  totalJobs: number;
  pendingPayout: number;
}

export async function getPaymentsByWorker(workerId: number | string): Promise<Payment[]> {
  const res = await client.get<Payment[]>(`/payments/worker/${workerId}`);
  return res.data;
}

export async function getWorkerPaymentSummary(workerId: number | string): Promise<WorkerPaymentSummary> {
  const res = await client.get<WorkerPaymentSummary>(`/payments/worker/${workerId}/summary`);
  return res.data;
}

// ── SUBSCRIPTIONS: worker "Pro" plan ───────────────────────────────────────

export interface ProInitiateResult {
  authorizationUrl: string;
  reference: string;
  amount: string;
  days: string;
}

export async function initiateProSubscription(): Promise<ProInitiateResult> {
  const res = await client.post<ProInitiateResult>('/payments/subscription/initiate');
  return res.data;
}

export async function verifyProSubscription(reference: string): Promise<{ status: string }> {
  const res = await client.post<{ status: string }>('/payments/subscription/verify', { reference });
  return res.data;
}