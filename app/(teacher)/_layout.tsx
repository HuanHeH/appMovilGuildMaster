import { Redirect, Tabs, useRouter } from 'expo-router';
import { Icon, IconButton } from 'react-native-paper';

import { useAuthStore } from '@/store/auth-store';

export default function TeacherTabsLayout() {
  const router = useRouter();
  const role = useAuthStore((state) => state.session?.role);
  const clearSession = useAuthStore((state) => state.clearSession);

  const onLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Teacher') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => (
          <IconButton icon="logout" onPress={onLogout} accessibilityLabel="Logout" />
        ),
      }}
    >
      <Tabs.Screen
        name="profe1"
        options={{
          title: 'Profe1',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account-group" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profe2"
        options={{
          title: 'Profe2',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profe3"
        options={{
          title: 'Profe3',
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

