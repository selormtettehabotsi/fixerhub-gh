import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutServer } from '../api/auth';
import * as tokenStorage from '../utils/tokenStorage';

interface AuthState {
  token: string | null;
  role: string | null;
  userId: string | null;
  name: string | null;
  phone: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    token: null,
    role: null,
    userId: null,
    name: null,
    phone: null,
    loading: true,
  });

  useEffect(() => {
    loadAuth();
  }, []);

  async function loadAuth() {
    const [token, role, userId, name, phone] = await Promise.all([
      tokenStorage.getItem('token'),
      AsyncStorage.getItem('role'),
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('name'),
      AsyncStorage.getItem('phone'),
    ]);
    setState({ token, role, userId, name, phone, loading: false });
  }

  const logout = useCallback(async () => {
    // TOKENS (H6): revoke the refresh token server-side, then clear local state.
    const refreshToken = await tokenStorage.getItem('refreshToken');
    await logoutServer(refreshToken);
    await tokenStorage.multiRemove(['token', 'refreshToken', 'role', 'userId', 'name', 'phone']);
    setState({ token: null, role: null, userId: null, name: null, phone: null, loading: false });
  }, []);

  return { ...state, logout, reload: loadAuth };
}
