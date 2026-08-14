import { MD3DarkTheme } from 'react-native-paper';

import type { EventStatus } from '@/types/game';

/** GuildMaster mobile palette — 60% black, 30% red, 10% white (Stitch / MD3). */
export const GM = {
  black: '#000000',
  background: '#131313',
  surfaceContainer: '#0a0a0a',
  surfaceSubtle: '#111111',
  surfaceElevated: '#1a1a1a',
  surfaceLow: '#1c1b1b',
  outline: '#333333',
  outlineVariant: '#5b403e',
  primary: '#ef4444',
  primaryHover: '#dc2626',
  primaryContainer: '#ff5451',
  primaryDark: '#7f1d1d',
  primaryDeep: '#930013',
  onPrimary: '#ffffff',
  onBackground: '#ffffff',
  onSurface: '#ffffff',
  onSurfaceMuted: '#f3f4f6',
  onSurfaceVariant: '#e4beba',
  tertiary: '#c6c6c6',
  error: '#b91c1c',
  errorContainer: '#7f1d1d',
  inverseSurface: '#e5e2e1',
  inverseOnSurface: '#313030',
  white: '#ffffff',
  accentSoft: '#ffb3ad',
} as const;

export const guildMasterTheme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,
    primary: GM.primary,
    onPrimary: GM.onPrimary,
    primaryContainer: GM.primaryDark,
    onPrimaryContainer: '#f87171',
    secondary: GM.white,
    onSecondary: GM.black,
    background: GM.black,
    onBackground: GM.onBackground,
    surface: GM.surfaceSubtle,
    onSurface: GM.onSurface,
    surfaceVariant: GM.surfaceElevated,
    onSurfaceVariant: GM.onSurfaceMuted,
    outline: GM.outline,
    outlineVariant: GM.outlineVariant,
    error: GM.error,
    errorContainer: GM.errorContainer,
    onError: GM.onPrimary,
    onErrorContainer: '#ffdad6',
    elevation: {
      level0: GM.black,
      level1: GM.surfaceContainer,
      level2: GM.surfaceSubtle,
      level3: GM.surfaceElevated,
      level4: '#20201f',
      level5: '#2a2a2a',
    },
  },
};

export const tabScreenOptions = {
  tabBarStyle: {
    backgroundColor: GM.black,
    borderTopColor: GM.outline,
    borderTopWidth: 1,
  },
  tabBarActiveTintColor: GM.primary,
  tabBarInactiveTintColor: GM.tertiary,
  headerStyle: { backgroundColor: GM.black },
  headerTintColor: GM.onBackground,
};

export const screenBg = { flex: 1, backgroundColor: GM.black } as const;

export const centerScreenBg = {
  flex: 1,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: GM.black,
};

export const headerStyle = {
  paddingHorizontal: 12,
  paddingBottom: 8,
  backgroundColor: GM.black,
  borderBottomWidth: 1,
  borderBottomColor: GM.outline,
  gap: 8,
};

export const filtersCardStyle = {
  backgroundColor: GM.surfaceContainer,
  borderColor: GM.outline,
};

export const accordionStyle = {
  backgroundColor: GM.surfaceContainer,
  borderWidth: 1,
  borderColor: GM.outline,
  borderRadius: 10,
};

export const modalContentStyle = {
  margin: 16,
  backgroundColor: GM.surfaceContainer,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: GM.outline,
  padding: 16,
  maxHeight: '85%' as const,
};

export const highlightText = { color: GM.primary, fontWeight: '700' as const };

export const mutedLabel = { color: GM.tertiary };

export const commentChipColors = {
  bg: GM.surfaceElevated,
  border: GM.primary,
  text: GM.accentSoft,
  icon: GM.primary,
};

export function selectedRowStyle(selected: boolean) {
  return {
    borderWidth: 1,
    borderRadius: 10,
    borderColor: selected ? GM.primary : GM.outline,
    backgroundColor: selected ? GM.surfaceElevated : GM.black,
  };
}

export function eventStatusCardStyle(status: EventStatus, reviewedAt: string | null) {
  switch (status) {
    case 'PENDING':
      return { backgroundColor: GM.surfaceContainer, borderColor: GM.primary };
    case 'REJECTED':
      return { backgroundColor: GM.errorContainer, borderColor: GM.error };
    case 'AUTO':
      return { backgroundColor: GM.surfaceSubtle, borderColor: GM.outline };
    case 'APPROVED':
      return reviewedAt
        ? { backgroundColor: GM.surfaceElevated, borderColor: GM.white }
        : { backgroundColor: GM.surfaceSubtle, borderColor: GM.outline };
    default:
      return { backgroundColor: GM.surfaceSubtle, borderColor: GM.outline };
  }
}

export function eventStatusBadgeStyle(status: EventStatus) {
  switch (status) {
    case 'PENDING':
      return { bg: GM.surfaceElevated, border: GM.primary, text: GM.onSurface, label: 'Pending' };
    case 'REJECTED':
      return { bg: GM.error, border: GM.error, text: GM.onPrimary, label: 'Rejected' };
    case 'AUTO':
      return { bg: GM.surfaceElevated, border: GM.outline, text: GM.onSurfaceMuted, label: 'Auto' };
    case 'APPROVED':
      return { bg: GM.white, border: GM.white, text: GM.black, label: 'Approved' };
    default:
      return { bg: GM.surfaceElevated, border: GM.outline, text: GM.onSurfaceMuted, label: status };
  }
}

export function eventReviewChipStyle(status: EventStatus) {
  if (status === 'REJECTED') {
    return {
      bg: GM.errorContainer,
      border: GM.error,
      text: GM.onPrimary,
      icon: 'account-cancel-outline' as const,
    };
  }
  return {
    bg: GM.surfaceElevated,
    border: GM.white,
    text: GM.onSurface,
    icon: 'account-check-outline' as const,
  };
}

export function skillCardStyle(common: boolean, locked: boolean) {
  if (common) {
    return {
      borderColor: locked ? GM.outline : GM.primary,
      backgroundColor: locked ? GM.surfaceElevated : GM.surfaceContainer,
      titleColor: locked ? GM.tertiary : GM.primary,
      descColor: locked ? GM.tertiary : GM.onSurfaceMuted,
      buttonColor: locked ? undefined : GM.primary,
    };
  }
  return {
    borderColor: locked ? GM.outline : GM.outlineVariant,
    backgroundColor: locked ? GM.surfaceContainer : GM.surfaceSubtle,
    titleColor: locked ? GM.tertiary : GM.onSurface,
    descColor: locked ? GM.tertiary : GM.onSurfaceMuted,
    buttonColor: undefined as string | undefined,
  };
}

export const teacherSkillCardStyle = {
  borderWidth: 1,
  borderColor: GM.outline,
  borderRadius: 10,
  padding: 12,
  backgroundColor: GM.surfaceContainer,
  gap: 6,
};
