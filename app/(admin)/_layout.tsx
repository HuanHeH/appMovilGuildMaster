import { Redirect, Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { Icon, IconButton } from 'react-native-paper';

import { AppSidebar } from '@/components/AppSidebar';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { ChangeUsernameModal } from '@/components/ChangeUsernameModal';
import { SettingsMenuModal } from '@/components/SettingsMenuModal';
import { logout } from '@/lib/api';
import { GM, tabScreenOptions } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';

export default function AdminTabsLayout() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const session = useAuthStore((state) => state.session);
  const role = session?.role;
  const clearSession = useAuthStore((state) => state.clearSession);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [usernameVisible, setUsernameVisible] = useState(false);

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear the local session even if the server is unavailable.
    } finally {
      clearSession();
      router.replace('/login');
    }
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Admin') return <Redirect href="/" />;

  return (
    <Tabs
      tabBar={
        isDesktop
          ? (props) => (
              <AppSidebar
                {...props}
                brandTitle="Admin GuildMaster"
                userName={session?.name}
                onLogout={onLogout}
                onChangePassword={() => setSettingsVisible(true)}
              />
            )
          : undefined
      }
      screenOptions={{
        ...tabScreenOptions,
        headerShown: !isDesktop,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarStyle: isDesktop
          ? {
              backgroundColor: GM.surfaceContainer,
              borderTopWidth: 0,
              borderRightWidth: 0,
              elevation: 0,
              width: 240,
            }
          : tabScreenOptions.tabBarStyle,
        headerRight: () => (
          <IconButton
            icon="cog"
            onPress={() => setSettingsVisible(true)}
            accessibilityLabel="Settings"
          />
        ),
      }}>
      <Tabs.Screen
        name="admin1"
        options={{
          title: 'Admin1',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin2"
        options={{
          title: 'Admin2',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-group" color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin3"
        options={{
          title: 'Admin3',
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar" color={String(color)} size={size} />
          ),
        }}
      />
      <SettingsMenuModal
        visible={settingsVisible}
        onDismiss={() => setSettingsVisible(false)}
        onChangeUsername={() => setUsernameVisible(true)}
        onLogout={onLogout}
      />
      <ChangeUsernameModal
        visible={usernameVisible}
        onDismiss={() => setUsernameVisible(false)}
      />
    </Tabs>
  );
}
