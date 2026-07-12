import client from './client';

export interface ReportPayload {
  category: string;
  description: string;
}

export async function submitReport(payload: ReportPayload): Promise<void> {
  await client.post('/auth/reports', payload);
}
