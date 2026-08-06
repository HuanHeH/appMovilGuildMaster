import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { getGuilds } from '@/lib/api';
import type { Guild } from '@/types/game';

type GuildState = {
  selectedGuildId: number | null;
  guilds: Guild[];
  setSelectedGuildId: (id: number | null) => void;
  setGuilds: (guilds: Guild[]) => void;
  /** Reload mentorship guilds from API. */
  refreshGuilds: () => Promise<Guild[]>;
};

const memoryStore: Record<string, string> = {};

const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined'
          ? localStorage.getItem(name)
          : (memoryStore[name] ?? null);
      }
      return (await SecureStore.getItemAsync(name)) ?? memoryStore[name] ?? null;
    } catch {
      return memoryStore[name] ?? null;
    }
  },
  setItem: async (name, value) => {
    memoryStore[name] = value;
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.setItem(name, value);
        return;
      }
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Keep in-memory value.
    }
  },
  removeItem: async (name) => {
    delete memoryStore[name];
    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(name);
        return;
      }
      await SecureStore.deleteItemAsync(name);
    } catch {
      // Ignore.
    }
  },
};

export const useGuildStore = create<GuildState>()(
  persist(
    (set, get) => ({
      selectedGuildId: null,
      guilds: [],
      setSelectedGuildId: (id) => set({ selectedGuildId: id }),
      setGuilds: (guilds) => {
        const selectedId = get().selectedGuildId;
        if (selectedId != null && !guilds.some((g) => g.id === selectedId)) {
          set({ guilds, selectedGuildId: null });
          return;
        }
        set({ guilds });
      },
      refreshGuilds: async () => {
        const data = await getGuilds();
        const selectedId = get().selectedGuildId;
        if (selectedId != null && !data.some((g) => g.id === selectedId)) {
          set({ guilds: data, selectedGuildId: null });
        } else {
          set({ guilds: data });
        }
        return data;
      },
    }),
    {
      name: 'gm_selected_guild',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ selectedGuildId: state.selectedGuildId }),
    }
  )
);

export function selectSelectedGuild(state: GuildState): Guild | null {
  return state.guilds.find((g) => g.id === state.selectedGuildId) ?? null;
}
