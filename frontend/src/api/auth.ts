import client from './client';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: 'CUSTOMER' | 'WORKER';
  phone: string;
  location: string;
  skill?: string;
  /** REFERRALS: optional invite code from an existing user. */
  referralCode?: string;
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

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
}

/** EDIT PROFILE: update name/email/phone. If the email changed, the response
 *  carries a fresh token pair (email is the JWT identity) — the caller must
 *  store them. */
export async function updateProfile(payload: UpdateProfilePayload): Promise<AuthResponse> {
  const res = await client.put<AuthResponse>('/auth/profile', payload);
  return res.data;
}

/** CHANGE PASSWORD: requires the current password. Response carries a fresh
 *  token pair (all other sessions are revoked) — the caller must store them. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthResponse> {
  const res = await client.put<AuthResponse>('/auth/password', { currentPassword, newPassword });
  return res.data;
}

// ── REFERRALS ──────────────────────────────────────────────────────────────

export interface ReferralInfo {
  code: string;
  count: number;
}

/** Own referral code + number of invitees who completed their first paid booking. */
export async function getMyReferral(): Promise<ReferralInfo> {
  const res = await client.get<ReferralInfo>('/auth/referrals/me');
  return res.data;
}

// ── VERIFICATION: email (mail OTP) + phone (SMS OTP), badge-only ──────────

export type VerifyChannel = 'EMAIL' | 'PHONE';

export interface VerificationStatus {
  emailVerified: boolean;
  phoneVerified: boolean;
}

export async function getVerificationStatus(): Promise<VerificationStatus> {
  const res = await client.get<VerificationStatus>('/auth/verify/status');
  return res.data;
}

export async function sendVerifyOtp(channel: VerifyChannel): Promise<void> {
  await client.post('/auth/verify/send', { channel });
}

export async function confirmVerifyOtp(channel: VerifyChannel, otp: string): Promise<VerificationStatus> {
  const res = await client.post<VerificationStatus>('/auth/verify/confirm', { channel, otp });
  return res.data;
}
