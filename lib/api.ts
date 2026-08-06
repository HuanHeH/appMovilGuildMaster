import { create } from 'axios';
import Constants from 'expo-constants';
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
  Constants.expoConfig?.extra?.apiBaseUrl ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8081/api' : 'http://localhost:8081/api');

export const api = create({
  baseURL: configuredBaseUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  if (session?.accessToken && session.role !== 'Admin') {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

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

/** Student characters across all guilds (API requires guild_id per request). */
export async function getMyCharacters(): Promise<Character[]> {
  const session = useAuthStore.getState().session;
  if (!session) return [];
  const guilds = await getGuilds();
  if (!guilds.length) return [];
  const batches = await Promise.all(guilds.map((guild) => getCharacters(guild.id)));
  const mine = new Map<number, Character>();
  for (const batch of batches) {
    for (const character of batch) {
      if (character.user_id === session.id) mine.set(character.id, character);
    }
  }
  return Array.from(mine.values());
}
