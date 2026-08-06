import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

type GuildState = {
  selectedGuildId: number | null;
  setSelectedGuildId: (id: number | null) => void;
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
    (set) => ({
      selectedGuildId: null,
      setSelectedGuildId: (id) => set({ selectedGuildId: id }),
    }),
    {
      name: 'gm_selected_guild',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
