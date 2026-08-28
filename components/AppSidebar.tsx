import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GM } from '@/lib/guildmaster-theme';

export type AppSidebarProps = {
  state: any;
  descriptors: any;
  navigation: any;
  brandTitle: string;
  contextLabel?: string | null;
  contextIcon?: string;
  userName?: string | null;
  onLogout: () => void;
  onChangePassword?: () => void;
};

/**
 * Notion-like left rail for desktop web: brand, nav, context chip, user + logout.
 * Used as Tabs `tabBar` when `tabBarPosition: 'left'`.
 */
export function AppSidebar({
  state,
  descriptors,
  navigation,
  brandTitle,
  contextLabel,
  contextIcon = 'information-outline',
  userName,
  onLogout,
  onChangePassword,
}: AppSidebarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        width: 240,
        alignSelf: 'stretch',
        backgroundColor: GM.surfaceContainer,
        borderRightWidth: 1,
        borderRightColor: GM.outline,
        paddingHorizontal: 8,
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: 'column',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 8,
          paddingVertical: 8,
          marginBottom: 12,
        }}>
        <Icon source="sword-cross" size={22} color={GM.primary} />
        <Text
          variant="titleSmall"
          numberOfLines={2}
          style={{ color: GM.primary, fontWeight: '700', flex: 1 }}>
          {brandTitle}
        </Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options ?? {};
          const tabBarLabel = options.tabBarLabel;
          const title = options.title;
          const label =
            typeof tabBarLabel === 'string'
              ? tabBarLabel
              : typeof title === 'string'
                ? title
                : route.name;
          const focused = state.index === index;
          const color = focused ? GM.primary : GM.tertiary;
          const tabBarIcon = options.tabBarIcon as
            | ((props: { focused: boolean; color: string; size: number }) => ReactNode)
            | undefined;
          const accessibilityLabel =
            typeof options.tabBarAccessibilityLabel === 'string'
              ? options.tabBarAccessibilityLabel
              : label;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };
          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={accessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderRadius: 6,
                paddingHorizontal: 10,
                paddingVertical: 8,
                backgroundColor: focused
                  ? GM.surfaceElevated
                  : pressed
                    ? GM.surfaceElevated
                    : 'transparent',
              })}>
              {tabBarIcon ? tabBarIcon({ focused, color, size: 20 }) : null}
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={{
                  color: focused ? GM.onSurface : GM.tertiary,
                  fontWeight: focused ? '600' : '400',
                  flex: 1,
                }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {contextLabel ? (
        <View
          style={{
            marginTop: 12,
            borderTopWidth: 1,
            borderTopColor: GM.outline,
            paddingTop: 12,
            paddingHorizontal: 8,
          }}>
          <Text variant="labelSmall" style={{ color: GM.tertiary, marginBottom: 6 }}>
            Active
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              borderRadius: 6,
              borderWidth: 1,
              borderColor: GM.outline,
              backgroundColor: GM.black,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}>
            <Icon source={contextIcon} size={16} color={GM.primary} />
            <Text
              variant="bodySmall"
              numberOfLines={3}
              style={{ color: GM.onSurface, flex: 1, fontWeight: '500' }}>
              {contextLabel}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={{
          marginTop: 'auto',
          borderTopWidth: 1,
          borderTopColor: GM.outline,
          paddingTop: 8,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Icon source="account-circle-outline" size={22} color={GM.tertiary} />
          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={{ color: GM.onSurface, flex: 1, fontWeight: '500' }}>
            {userName ?? 'Unknown'}
          </Text>
          {onChangePassword ? (
            <IconButton
              icon="lock-reset"
              size={18}
              onPress={onChangePassword}
              accessibilityLabel="Change password"
              style={{ margin: 0 }}
            />
          ) : null}
          <IconButton
            icon="logout"
            size={18}
            onPress={onLogout}
            accessibilityLabel="Logout"
            style={{ margin: 0 }}
          />
        </View>
      </View>
    </View>
  );
}
