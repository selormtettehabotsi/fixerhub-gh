import client from './client';

export interface Worker {
  id: number;
  name: string;
  email: string;
  skill: string;
  location: string;
  rating: number;
  available: boolean;
  latitude?: number;
  longitude?: number;
  phone?: string;
  bio?: string;
  ratePerHour?: number;
}

export async function getNearbyWorkers(
  lat: number,
  lng: number,
  skill?: string
): Promise<Worker[]> {
  const params: Record<string, string | number> = { lat, lng };
  if (skill) params.skill = skill;
  const res = await client.get<Worker[]>('/workers/nearby', { params });
  return res.data;
}

export async function getWorker(id: number | string): Promise<Worker> {
  const res = await client.get<Worker>(`/workers/${id}`);
  return res.data;
}

export async function setAvailability(id: number | string, available: boolean): Promise<void> {
  await client.put(`/workers/${id}/availability`, null, { params: { available } });
}

export async function getWorkerByUserId(userId: number | string): Promise<Worker> {
  const res = await client.get<Worker>(`/workers/by-user/${userId}`);
  return res.data;
}

export async function setAvailabilityByUserId(userId: number | string, available: boolean): Promise<void> {
  await client.put(`/workers/by-user/${userId}/availability`, null, { params: { available } });
}
