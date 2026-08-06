import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import { getMyCharacters } from '@/lib/api';
import type { Character } from '@/types/game';

type CharacterState = {
  selectedCharacterId: number | null;
  characters: Character[];
  setSelectedCharacterId: (id: number | null) => void;
  setCharacters: (characters: Character[]) => void;
  /** Reload characters from API (level / exp / job). */
  refreshCharacters: () => Promise<Character[]>;
};

/** In-memory fallback when native storage is unavailable (e.g. some Expo/web setups). */
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
      // Keep in-memory value so selection still works this session.
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
      // Ignore native storage failures.
    }
  },
};

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      selectedCharacterId: null,
      characters: [],
      setSelectedCharacterId: (id) => set({ selectedCharacterId: id }),
      setCharacters: (characters) => {
        const selectedId = get().selectedCharacterId;
        if (selectedId != null && !characters.some((c) => c.id === selectedId)) {
          set({ characters, selectedCharacterId: null });
          return;
        }
        set({ characters });
      },
      refreshCharacters: async () => {
        const mine = await getMyCharacters();
        const selectedId = get().selectedCharacterId;
        if (selectedId != null && !mine.some((c) => c.id === selectedId)) {
          set({ characters: mine, selectedCharacterId: null });
        } else {
          set({ characters: mine });
        }
        return mine;
      },
    }),
    {
      name: 'gm_selected_character',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ selectedCharacterId: state.selectedCharacterId }),
    }
  )
);

export function selectSelectedCharacter(state: CharacterState): Character | null {
  return state.characters.find((c) => c.id === state.selectedCharacterId) ?? null;
}
