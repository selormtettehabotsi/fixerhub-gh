import client from './client';

export interface AdminStats {
  totalUsers: number;
  totalBookings: number;
  totalRevenue: number;
  totalCommission: number;
  totalWorkerPayouts: number;
  activeWorkers: number;
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

export type ReportStatus = 'OPEN' | 'REVIEWING' | 'RESOLVED';
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
  description: string;
  status: ReportStatus;
  createdAt: string; // ISO datetime from backend
}

/** Fetch all user-submitted reports (ADMIN only). Proxied via gateway to auth-service. */
export async function getReports(): Promise<Report[]> {
  const res = await client.get<Report[]>('/auth/reports');
  return res.data;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
  profilePicture?: string;
  createdAt?: string;
}

/** Fetch all users (customers + workers) from admin-service. */
export async function getAdminUsers(): Promise<AdminUser[]> {
  const res = await client.get<AdminUser[]>('/admin/users');
  return res.data;
}
