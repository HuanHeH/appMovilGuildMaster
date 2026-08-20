import { Redirect, Tabs, useRouter } from 'expo-router';
import { Icon, IconButton } from 'react-native-paper';

import { logout } from '@/lib/api';
import { tabScreenOptions } from '@/lib/guildmaster-theme';
import { useAuthStore } from '@/store/auth-store';

export default function AdminTabsLayout() {
  const router = useRouter();
  const role = useAuthStore((state) => state.session?.role);
  const clearSession = useAuthStore((state) => state.clearSession);

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
      screenOptions={{
        ...tabScreenOptions,
        headerShown: true,
        headerRight: () => (
          <IconButton icon="logout" onPress={onLogout} accessibilityLabel="Logout" />
        ),
      }}
    >
      <Tabs.Screen
        name="admin1"
        options={{
          title: 'Admin1',
          tabBarIcon: ({ color, size }) => (
            <Icon source="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin2"
        options={{
          title: 'Admin2',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-group" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin3"
        options={{
          title: 'Admin3',
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
