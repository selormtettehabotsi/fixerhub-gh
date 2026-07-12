import client from './client';

export interface PortfolioItem {
  id: number;
  workerId: number;
  imageUrl: string;
  caption?: string;
  createdAt?: string;
}

export async function getWorkerPortfolio(workerId: number | string): Promise<PortfolioItem[]> {
  const res = await client.get<PortfolioItem[]>(`/workers/${workerId}/portfolio`);
  return res.data;
}

export async function addPortfolioItem(workerId: number | string, imageUrl: string, caption?: string): Promise<PortfolioItem> {
  const res = await client.post<PortfolioItem>(`/workers/${workerId}/portfolio`, { imageUrl, caption });
  return res.data;
}

export async function deletePortfolioItem(portfolioId: number | string): Promise<void> {
  await client.delete(`/workers/portfolio/${portfolioId}`);
}
