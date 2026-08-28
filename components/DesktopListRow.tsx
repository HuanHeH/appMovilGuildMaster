import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { GM } from '@/lib/guildmaster-theme';

export type DesktopColDef = {
  key: string;
  label: string;
  /** flex grow; default 1 */
  flex?: number;
  /** fixed-ish min width */
  minWidth?: number;
};

type DesktopListHeaderProps = {
  columns: DesktopColDef[];
  style?: StyleProp<ViewStyle>;
  /** Reserve space matching a trailing action/badge column. */
  trailingWidth?: number;
};

/** D&D Beyond–style uppercase column headers above a list of wide rows. */
export function DesktopListHeader({ columns, style, trailingWidth = 0 }: DesktopListHeaderProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: GM.outline,
        },
        style,
      ]}>
      {columns.map((col) => (
        <View
          key={col.key}
          style={{
            flex: col.flex ?? 1,
            minWidth: col.minWidth,
          }}>
          <Text
            variant="labelSmall"
            style={{
              color: GM.tertiary,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              fontSize: 11,
            }}>
            {col.label}
          </Text>
        </View>
      ))}
      {trailingWidth > 0 ? <View style={{ width: trailingWidth }} /> : null}
    </View>
  );
}

type DesktopListRowProps = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Wide horizontal row shell (spell-list style). */
export function DesktopListRow({ children, onPress, onLongPress, selected, style }: DesktopListRowProps) {
  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: selected ? GM.selectedBorder : GM.outline,
          borderRadius: 8,
          backgroundColor: selected ? GM.selectedBg : GM.surfaceContainer,
        },
        style,
      ]}>
      {children}
    </View>
  );

  if (!onPress && !onLongPress) return body;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
      accessibilityRole="button">
      {body}
    </Pressable>
  );
}

type DesktopCellProps = {
  flex?: number;
  minWidth?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function DesktopCell({ flex = 1, minWidth, children, style }: DesktopCellProps) {
  return <View style={[{ flex, minWidth, justifyContent: 'center' }, style]}>{children}</View>;
}

type DesktopCellTextProps = {
  primary: string;
  secondary?: string | null;
  primaryStyle?: object;
  secondaryStyle?: object;
  numberOfLines?: number;
};

export function DesktopCellText({
  primary,
  secondary,
  primaryStyle,
  secondaryStyle,
  numberOfLines = 2,
}: DesktopCellTextProps) {
  return (
    <View style={{ gap: 2 }}>
      <Text
        numberOfLines={numberOfLines}
        style={{ color: GM.onSurface, fontWeight: '700', fontSize: 14, ...primaryStyle }}>
        {primary}
      </Text>
      {secondary ? (
        <Text
          numberOfLines={2}
          style={{ color: GM.tertiary, fontSize: 12, fontWeight: '500', ...secondaryStyle }}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}
