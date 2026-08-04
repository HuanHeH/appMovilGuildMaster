import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { API_ENDPOINTS } from '@/lib/endpoints';
import { useAuthStore } from '@/store/auth-store';
import type { LoginResponse } from '@/types/auth';

const configuredBaseUrl =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  // Android Emulator: `localhost` apunta al emulador, no al host donde corre la API.
  // 10.0.2.2 es el alias estándar del host desde el emulador.
  (Platform.OS === 'android' ? 'http://10.0.2.2:8081/api' : 'http://localhost:8081/api');

export const api = axios.create({
  baseURL: configuredBaseUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().session?.accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(mail: string, password: string) {
  const { data } = await api.post<LoginResponse>(API_ENDPOINTS.users.login, {
    mail,
    password,
  });
  return data;
}
