import client from './client';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'WORKER';
  phone: string;
  location: string;
  skill?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  role: string;
  userId: number;
  name?: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
}

// Keep LoginResponse as an alias for backward compat
export type LoginResponse = AuthResponse;

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/auth/register', payload);
  return res.data;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>('/auth/login', payload);
  return res.data;
}
