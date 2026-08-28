import { create } from 'axios';
import { Platform } from 'react-native';

import { API_ENDPOINTS } from '@/lib/endpoints';
import { useAuthStore } from '@/store/auth-store';
import type { LoginResponse } from '@/types/auth';
import type {
  Character,
  CreateEventRequest,
  GameEvent,
  Guild,
  Party,
  Skill,
  UserPublic,
} from '@/types/game';

const configuredBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ||
  (Platform.OS === 'web'
    ? 'https://api.guildmasterweb.com/api'
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:8081/api'
      : 'http://localhost:8081/api');

export const api = create({
  baseURL: configuredBaseUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url ?? '');
    const isLoginRequest = requestUrl.endsWith('/users/login');

    if (status === 401 && !isLoginRequest) {
      useAuthStore.getState().clearSession();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export function apiErrorMessage(error: unknown, fallback = 'Request failed') {
  const err = error as { response?: { data?: { message?: string }; status?: number }; message?: string };
  const apiMessage = err?.response?.data?.message;
  const status = err?.response?.status;
  if (apiMessage && status) return `${apiMessage} (HTTP ${status})`;
  if (apiMessage) return apiMessage;
  if (status) return `${fallback} (HTTP ${status})`;
  return err?.message ?? fallback;
}

export async function login(mail: string, password: string) {
  const { data } = await api.post<LoginResponse>(API_ENDPOINTS.users.login, { mail, password });
  return data;
}

export async function logout() {
  await api.post('/users/logout');
}

export async function changePassword(oldPassword: string, newPassword: string, confirmPassword: string) {
  await api.post(API_ENDPOINTS.users.changePassword, { oldPassword, newPassword, confirmPassword });
}

export async function changeUserName(id: number, name: string) {
  const { data } = await api.put<{ id: number; name: string }>(
    API_ENDPOINTS.users.changeName(id),
    { name }
  );
  return data;
}

export async function updateGuildName(id: number, name: string) {
  const { data } = await api.put<Guild>(API_ENDPOINTS.guilds.updateName(id), { name });
  return data;
}

export async function createParty(party: { name: string; guildId: number }) {
  const { data } = await api.post<Party>(API_ENDPOINTS.parties.create, party);
  return data;
}

export async function updateParty(id: number, payload: { name?: string }) {
  const { data } = await api.put<Party>(API_ENDPOINTS.parties.update(id), payload);
  return data;
}

export async function deleteParty(id: number) {
  await api.delete(API_ENDPOINTS.parties.remove(id));
}

export async function updateCharacterParty(characterId: number, partyId: number | null) {
  const { data } = await api.put<Character>(
    API_ENDPOINTS.characters.update(characterId),
    { party_id: partyId }
  );
  return data;
}

export async function getCharacters(guildId: number) {
  const { data } = await api.get<Character[]>(API_ENDPOINTS.characters.list, {
    params: { guild_id: guildId },
  });
  return data;
}

export async function getGuilds() {
  const { data } = await api.get<Guild[]>(API_ENDPOINTS.guilds.list);
  return data;
}

export async function getParties(guildId: number) {
  const { data } = await api.get<Party[]>(API_ENDPOINTS.parties.list, {
    params: { guild_id: guildId },
  });
  return data;
}

export async function getSkills() {
  const { data } = await api.get<Skill[]>(API_ENDPOINTS.skills.list);
  return data;
}

export async function getEvents(guildId: number) {
  const { data } = await api.get<GameEvent[]>(API_ENDPOINTS.events.list, {
    params: { guild_id: guildId },
  });
  return data;
}

export async function getUsers(guildId: number) {
  const { data } = await api.get<UserPublic[]>(API_ENDPOINTS.users.list, {
    params: { guild_id: guildId },
  });
  return data;
}

export async function createEvent(payload: CreateEventRequest) {
  const { data } = await api.post<GameEvent>(API_ENDPOINTS.events.create, payload);
  return data;
}

export async function updateEvent(
  id: number,
  payload: Partial<Pick<GameEvent, 'status' | 'comment'>>
) {
  const { data } = await api.put<GameEvent>(API_ENDPOINTS.events.update(id), payload);
  return data;
}

/** Student: cancel own PENDING event (refunds ExpCost). Admin: delete any. */
export async function deleteEvent(id: number) {
  await api.delete(API_ENDPOINTS.events.remove(id));
}

/** Student characters across all guilds (API requires guild_id per request). */
export async function getMyCharacters(): Promise<Character[]> {
  if (!useAuthStore.getState().session) return [];
  const { data } = await api.get<Character[]>(API_ENDPOINTS.characters.mine);
  return data;
}
