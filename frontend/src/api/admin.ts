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
