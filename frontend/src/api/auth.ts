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
  /** TOKENS (H6): opaque refresh token — stored and exchanged automatically by the API client. */
  refreshToken?: string;
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

export interface PublicUserInfo {
  id: number;
  name: string;
  profilePicture?: string;
  role: string;
}

/** Fetch any user's public profile (name + profile picture) by user ID.
 *  No auth token required. */
export async function getUserPublic(userId: number | string): Promise<PublicUserInfo> {
  const res = await client.get<PublicUserInfo>(`/auth/users/${userId}/public`);
  return res.data;
}

/** TOKENS (H6): revoke the refresh token server-side on logout. */
export async function logoutServer(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await client.post('/auth/logout', { refreshToken });
  } catch {
    // Best effort — local logout proceeds regardless.
  }
}

/** Permanently delete the authenticated user's account.
 *  Password is required to confirm the deletion. */
export async function deleteAccount(password: string): Promise<{ message: string }> {
  const res = await client.delete<{ message: string }>('/auth/account', { data: { password } });
  return res.data;
}
