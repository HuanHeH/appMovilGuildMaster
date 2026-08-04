import { Redirect, Tabs, useRouter } from 'expo-router';
import { Icon, IconButton } from 'react-native-paper';

import { useAuthStore } from '@/store/auth-store';

export default function StudentTabsLayout() {
  const router = useRouter();
  const role = useAuthStore((state) => state.session?.role);
  const clearSession = useAuthStore((state) => state.clearSession);

  const onLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Student') return <Redirect href="/" />;

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
        name="alumno1"
        options={{
          title: 'Alumno1',
          tabBarIcon: ({ color, size }) => (
            <Icon source="school" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="alumno2"
        options={{
          title: 'Alumno2',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="alumno3"
        options={{
          title: 'Alumno3',
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

