import client from './client';

export async function verifyWorker(workerId: number | string) {
  const res = await client.put(`/workers/${workerId}/verify`);
  return res.data;
}

export async function unverifyWorker(workerId: number | string) {
  const res = await client.put(`/workers/${workerId}/unverify`);
  return res.data;
}

export async function uploadVerificationDocument(workerId: number | string, documentUrl: string) {
  const res = await client.post(`/workers/${workerId}/upload-document`, { documentUrl });
  return res.data;
}
