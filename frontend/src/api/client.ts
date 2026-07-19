import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { router } from 'expo-router';
import * as tokenStorage from '../utils/tokenStorage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── TOKENS (H6): auto-refresh on 401 ────────────────────────────────────────
// Access tokens are short-lived (15 min). On a 401 we exchange the stored
// refresh token for a new pair, retry the original request once, and only
// log the user out if the refresh itself fails.

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStorage.getItem('refreshToken');
  if (!refreshToken) return null;
  try {
    // Plain axios (not `client`) so this call skips the interceptors.
    const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
    const { token, refreshToken: newRefreshToken } = res.data ?? {};
    if (!token) return null;
    await tokenStorage.multiSet([
      ['token', token],
      ['refreshToken', newRefreshToken ?? ''],
    ]);
    return token;
  } catch {
    return null;
  }
}

async function forceLogout() {
  await tokenStorage.multiRemove([
    'token', 'refreshToken', 'role', 'userId', 'name', 'email', 'phone', 'profilePicture',
  ]);
  try {
    router.replace('/(auth)/login');
  } catch {
    // Router not ready (e.g. during app start) — storage is cleared, so the
    // next navigation guard will land on login anyway.
  }
}

// ── WEBSOCKET AUTH FIX ──────────────────────────────────────────────────────
// STOMP connections can't use the axios 401-refresh interceptor, so they call
// this instead: returns a token guaranteed to have >60s of life left,
// refreshing it via the stored refresh token when needed. Chat/tracking were
// stuck on "Connecting…" forever because they reconnected with an expired JWT.

function jwtExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    // Hermes (RN 0.74+) provides global atob
    const json = JSON.parse(decodeURIComponent(
      atob(b64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    ));
    return typeof json.exp === 'number' ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function getFreshAccessToken(): Promise<string | null> {
  const token = await tokenStorage.getItem('token');
  if (token) {
    const exp = jwtExpiryMs(token);
    // Keep using it if it can't be decoded (server will judge) or has >60s left
    if (exp === null || exp - Date.now() > 60_000) return token;
  }
  refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

function isAuthPath(url?: string): boolean {
  return !!url && (url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh'));
}

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retried && !isAuthPath(original.url)) {
      original._retried = true;
      // De-duplicate concurrent refreshes: all 401s share one refresh call.
      refreshPromise = refreshPromise ?? refreshAccessToken().finally(() => { refreshPromise = null; });
      const newToken = await refreshPromise;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      }
      await forceLogout();
    }

    const data = error.response?.data as any;
    const message =
      (typeof data === 'string' ? data : null) ??
      data?.message ??
      data?.error ??
      (data ? JSON.stringify(data) : null) ??
      error.message ??
      'An error occurred';
    return Promise.reject(new Error(String(message)));
  }
);

export default client;
