import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('role'),
      AsyncStorage.getItem('userId'),
      AsyncStorage.getItem('name'),
      AsyncStorage.getItem('phone'),
    ]);
    setState({ token, role, userId, name, phone, loading: false });
  }

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['token', 'role', 'userId', 'name', 'phone']);
    setState({ token: null, role: null, userId: null, name: null, phone: null, loading: false });
  }, []);

  return { ...state, logout, reload: loadAuth };
}
