import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8080';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
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
