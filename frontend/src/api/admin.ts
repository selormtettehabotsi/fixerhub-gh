import client from './client';

export interface AdminStats {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  totalCommission: number;
  totalWorkerPayouts: number;
  activeWorkers: number;
  /** SUBSCRIPTIONS: workers with an active PRO plan. */
  proWorkers?: number;
  /** REFERRALS: signups that used a referral code / converted referrals. */
  referredSignups?: number;
  creditedReferrals?: number;
}

export interface DailyPoint {
  date: string;      // "2026-07-19"
  count?: number;    // bookings
  amount?: number;   // revenue GH₵
}

export interface DailyStats {
  bookingsDaily: DailyPoint[];
  revenueDaily: DailyPoint[];
}

/** ADMIN CHARTS: bookings + revenue per day (zero-filled series). */
export async function getAdminDailyStats(days = 14): Promise<DailyStats> {
  const res = await client.get<DailyStats>(`/admin/stats/daily?days=${days}`);
  return res.data;
}

export interface AdminWorker {
  id: number;
  name: string;
  skill: string;
  location: string;
  phone: string;
  rating: number;
  available: boolean;
  verified: boolean;
  profilePicture?: string;
}

export type VerificationStatus =
  | 'NONE'
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'RESUBMIT_REQUESTED';

export interface WorkerVerification {
  id: number;
  userId: number;
  name: string;
  skill: string;
  location: string | null;
  phone: string | null;
  rating: number;
  available: boolean;
  verified: boolean;
  profilePicture?: string;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  headshotUrl?: string;
}

export async function getAdminStats(): Promise<AdminStats> {
  const res = await client.get<AdminStats>('/admin/stats');
  return res.data;
}

export async function getAdminWorkers(): Promise<AdminWorker[]> {
  const res = await client.get<AdminWorker[]>('/admin/workers');
  return res.data;
}

export async function verifyWorker(id: number): Promise<AdminWorker> {
  const res = await client.put<AdminWorker>(`/admin/workers/${id}/verify`);
  return res.data;
}

export async function unverifyWorker(id: number): Promise<AdminWorker> {
  const res = await client.put<AdminWorker>(`/admin/workers/${id}/unverify`);
  return res.data;
}

// ─── KYC Verification ────────────────────────────────────────────────────────

export async function getPendingVerifications(): Promise<WorkerVerification[]> {
  const res = await client.get<WorkerVerification[]>('/admin/workers/verification/pending');
  return res.data;
}

/** Throws if the response contains an error field (backend silent-fail guard). */
function assertNoError(data: any, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String(data.error) || fallback);
  }
}

export async function approveVerification(id: number): Promise<void> {
  const res = await client.put(`/admin/workers/${id}/verification/approve`);
  assertNoError(res.data, 'Failed to approve verification');
}

export async function declineVerification(id: number, note: string): Promise<void> {
  const res = await client.put(`/admin/workers/${id}/verification/decline`, { note });
  assertNoError(res.data, 'Failed to decline verification');
}

export async function requestResubmit(id: number, note: string): Promise<void> {
  const res = await client.put(`/admin/workers/${id}/verification/request-resubmit`, { note });
  assertNoError(res.data, 'Failed to request resubmission');
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export type ReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
export type ReportCategory =
  | 'PAYMENT_PROBLEM'
  | 'IN_APP_ISSUE'
  | 'WORKER_PROBLEM'
  | 'CUSTOMER_PROBLEM'
  | 'OTHER';

export interface Report {
  id: number;
  reporterId: number;
  reporterEmail: string;
  reporterName: string;
  reporterProfilePicture?: string;
  category: ReportCategory;
  /** Booking linked to a dispute — enables refund / release-payout actions. */
  bookingId?: number | null;
  description: string;
  status: ReportStatus;
  resolutionNote?: string | null;
  resolvedAt?: string | null;
  createdAt: string; // ISO datetime from backend
}

/** Fetch all user-submitted reports (ADMIN only). Proxied via gateway to auth-service. */
export async function getReports(): Promise<Report[]> {
  const res = await client.get<Report[]>('/auth/reports');
  return res.data;
}

/** DISPUTE RESOLUTION: move a report through OPEN → REVIEWING → RESOLVED/DISMISSED. */
export async function updateReportStatus(
  id: number,
  status: ReportStatus,
  note?: string
): Promise<Report> {
  const res = await client.put<Report>(`/auth/reports/${id}/status`, { status, note });
  return res.data;
}

/** Full Paystack refund for a paid booking (blocked once the worker was paid out). */
export async function refundBooking(bookingId: number): Promise<{ status: string }> {
  const res = await client.post(`/payments/booking/${bookingId}/refund`);
  return res.data;
}

/** Re-run a held/failed worker payout after a dispute is resolved. */
export async function releaseWorkerPayout(
  bookingId: number
): Promise<{ status: string; payoutStatus: string }> {
  const res = await client.post(`/payments/booking/${bookingId}/release-payout`);
  return res.data;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  suspended?: boolean;
  createdAt?: string;
}

/** Fetch all users (customers + workers) from admin-service. */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await client.get<AdminUser[]>('/admin/users');
  return res.data;
}

/** M2: paged users for the admin Users screen (newest first). */
export async function getAdminUsersPaged(page: number, size = 30): Promise<AdminUser[]> {
  const res = await client.get<AdminUser[]>(`/admin/users?page=${page}&size=${size}`);
  return res.data;
}

/** MODERATION: suspend or unsuspend an account (revokes their sessions). */
export async function setUserSuspended(id: number, suspended: boolean): Promise<AdminUser> {
  const res = await client.put<AdminUser>(`/auth/users/${id}/suspend`, { suspended });
  return res.data;
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export interface AdminBooking {
  id: number;
  customerId: number;
  workerId: number;
  workerName?: string;
  serviceType: string;
  status: string;
  amount?: number | null;
  quotedAmount?: number | null;
  recurrence?: string | null;
  createdAt?: string;
}

/** M2: paged bookings for the admin Bookings screen (newest first). */
export async function getAdminBookingsPaged(page: number, size = 30): Promise<AdminBooking[]> {
  const res = await client.get<AdminBooking[]>(`/admin/bookings?page=${page}&size=${size}`);
  return res.data;
}
