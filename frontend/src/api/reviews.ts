import client from './client';

export interface ReviewPayload {
  workerId: number;
  bookingId: number;
  customerId: number;
  rating: number;
  comment?: string;
  customerName?: string;
  customerProfilePicture?: string;
}

export interface Review {
  id: number;
  bookingId: number;
  customerId: number;
  workerId: number;
  rating: number;
  comment?: string;
  customerName?: string;
  customerProfilePicture?: string;
  createdAt: string;
}

export async function submitReview(payload: ReviewPayload): Promise<void> {
  await client.post('/reviews', payload);
}

export async function getWorkerReviews(workerId: number | string): Promise<Review[]> {
  const res = await client.get<Review[]>(`/reviews/worker/${workerId}`);
  return res.data;
}
