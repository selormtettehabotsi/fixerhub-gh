import client from './client';

/** RETENTION: customer favorites — saved workers for one-tap rebooking. */

export async function getFavorites(): Promise<number[]> {
  const res = await client.get<number[]>('/favorites');
  return res.data;
}

export async function addFavorite(workerId: number | string): Promise<void> {
  await client.post(`/favorites/${workerId}`);
}

export async function removeFavorite(workerId: number | string): Promise<void> {
  await client.delete(`/favorites/${workerId}`);
}
