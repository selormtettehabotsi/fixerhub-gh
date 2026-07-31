import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from '../utils/signOut';
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
    // Local wipe first, server revocation in the background — see utils/signOut.
    // Waiting on the network here made sign-out feel broken on a weak signal.
    await signOut();
    setState({ token: null, role: null, userId: null, name: null, phone: null, loading: false });
  }, []);

  return { ...state, logout, reload: loadAuth };
}
