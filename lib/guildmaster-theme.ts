import { Platform } from 'react-native';
import { MD3DarkTheme } from 'react-native-paper';

import type { EventStatus } from '@/types/game';

/**
 * Color tokens — keep in sync with CSS variables in `global.css`.
 * Used only where Paper / navigation APIs require hex strings.
 */
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
  /** Selected character/guild row (bluish, matches AUTO event tint). */
  selectedBg: '#0c1a2e',
  selectedBorder: '#3b82f6',
  selectedText: '#93c5fd',
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

/** Tab / stack chrome (navigation needs style objects). */
export const tabScreenOptions = {
  tabBarStyle: {
    backgroundColor: GM.black,
    borderTopColor: GM.outline,
    borderTopWidth: 1,
    // Keep bottom tabs pinned on mobile web (document scroll must not lift the bar).
    ...(Platform.OS === 'web'
      ? {
          position: 'sticky' as const,
          bottom: 0,
          zIndex: 40,
        }
      : null),
  },
  tabBarActiveTintColor: GM.primary,
  tabBarInactiveTintColor: GM.tertiary,
  headerStyle: {
    backgroundColor: GM.black,
    ...(Platform.OS === 'web'
      ? {
          position: 'sticky' as const,
          top: 0,
          zIndex: 40,
        }
      : null),
  },
  headerTintColor: GM.onBackground,
};

/** className helpers → classes defined in `global.css` */
export const screenClass = 'gm-screen';
export const centerScreenClass = 'gm-screen-center';
export const screenPadClass = 'gm-screen-pad';
export const filtersCardClass = 'gm-filters-card';
export const accordionClass = 'gm-accordion';
export const modalContentClass = 'gm-modal-content';
export const teacherSkillCardClass = 'gm-teacher-skill-card';
export const highlightTextClass = 'gm-text-highlight';

/** Paper Text on web ignores NativeWind className; use this for caster/target names. */
export function highlightNameStyle(active: boolean) {
  return active ? { color: GM.primary, fontWeight: '700' as const } : undefined;
}

/** Desktop Notion-like sidebar width (must match AppSidebar + tabBarStyle). */
export const DESKTOP_SIDEBAR_WIDTH = 240;
export const mutedLabelClass = 'gm-text-muted';
export const commentChipClass = 'gm-comment-chip';
export const commentChipTextClass = 'gm-comment-chip-text';

export function selectedRowClass(selected: boolean) {
  return selected ? 'gm-row-selected' : 'gm-row';
}

export function eventStatusCardClass(status: EventStatus) {
  switch (status) {
    case 'PENDING':
      return 'gm-event-card gm-event-card--pending';
    case 'REJECTED':
      return 'gm-event-card gm-event-card--rejected';
    case 'AUTO':
      return 'gm-event-card gm-event-card--auto';
    case 'APPROVED':
      return 'gm-event-card gm-event-card--approved';
    default:
      return 'gm-event-card gm-event-card--auto';
  }
}

export function eventStatusBadgeClass(status: EventStatus) {
  switch (status) {
    case 'PENDING':
      return {
        wrap: 'gm-event-badge gm-event-badge--pending',
        text: 'gm-event-badge-label gm-event-badge-text--pending',
        label: 'Pending',
      };
    case 'REJECTED':
      return {
        wrap: 'gm-event-badge gm-event-badge--rejected',
        text: 'gm-event-badge-label gm-event-badge-text--rejected',
        label: 'Rejected',
      };
    case 'AUTO':
      return {
        wrap: 'gm-event-badge gm-event-badge--auto',
        text: 'gm-event-badge-label gm-event-badge-text--auto',
        label: 'Auto',
      };
    case 'APPROVED':
      return {
        wrap: 'gm-event-badge gm-event-badge--approved',
        text: 'gm-event-badge-label gm-event-badge-text--approved',
        label: 'Approved',
      };
    default:
      return {
        wrap: 'gm-event-badge gm-event-badge--auto',
        text: 'gm-event-badge-label gm-event-badge-text--auto',
        label: status,
      };
  }
}

export function eventReviewChipColors(status: EventStatus) {
  if (status === 'REJECTED') {
    return {
      bg: '#450a0a',
      border: '#ef4444',
      text: '#fecaca',
      icon: 'account-cancel-outline' as const,
    };
  }
  if (status === 'APPROVED') {
    return {
      bg: '#052e16',
      border: '#22c55e',
      text: '#bbf7d0',
      icon: 'account-check-outline' as const,
    };
  }
  return {
    bg: GM.surfaceElevated,
    border: GM.white,
    text: GM.onSurface,
    icon: 'account-check-outline' as const,
  };
}

export function skillCardClass(common: boolean, locked: boolean, auto = false) {
  if (auto) {
    return 'gm-skill-card gm-skill-card--auto';
  }
  if (common) {
    return locked ? 'gm-skill-card gm-skill-card--common-locked' : 'gm-skill-card gm-skill-card--common';
  }
  return locked ? 'gm-skill-card gm-skill-card--job-locked' : 'gm-skill-card gm-skill-card--job';
}

/** Text colors for skill cards (Paper Text needs hex). */
export function skillCardTextColors(common: boolean, locked: boolean) {
  if (locked) {
    return { title: GM.tertiary, desc: GM.tertiary, button: undefined as string | undefined };
  }
  if (common) {
    return { title: GM.primary, desc: GM.onSurfaceMuted, button: GM.primary };
  }
  return { title: GM.onSurface, desc: GM.onSurfaceMuted, button: undefined as string | undefined };
}

/** Paper Modal / Accordion still need style objects. Web: capped width, centered. */
export const modalContentStyle = {
  margin: 16,
  alignSelf: 'center' as const,
  width: Platform.OS === 'web' ? ('92%' as const) : ('100%' as const),
  maxWidth: Platform.OS === 'web' ? 480 : undefined,
  backgroundColor: GM.surfaceContainer,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: GM.outline,
  padding: 16,
  maxHeight: '85%' as const,
};

export const accordionStyle = {
  backgroundColor: GM.surfaceContainer,
  borderWidth: 1,
  borderColor: GM.outline,
  borderRadius: 10,
};

export const headerClass = 'gm-header';
