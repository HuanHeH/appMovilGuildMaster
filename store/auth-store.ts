import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

import type { AuthSession } from '@/types/auth';

type AuthState = {
  session: AuthSession | null;
  hasHydrated: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
};

const memoryStore: Record<string, string> = {};

const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      if (Platform.OS === 'web') {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(name) : memoryStore[name] ?? null;
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
      // Keep the session in memory if secure storage is unavailable.
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
      // Ignore storage cleanup failures.
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hasHydrated: false,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'gm_session',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
