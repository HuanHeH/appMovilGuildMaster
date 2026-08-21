import { useWindowDimensions } from 'react-native';

/** Matches Notion-style desktop shell (sidebar + content). */
export const DESKTOP_BREAKPOINT = 900;

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
