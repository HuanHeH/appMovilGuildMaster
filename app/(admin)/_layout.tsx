import { Redirect, Tabs, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

import { useAuthStore } from '@/store/auth-store';

export default function AdminTabsLayout() {
  const router = useRouter();
  const role = useAuthStore((state) => state.session?.role);
  const clearSession = useAuthStore((state) => state.clearSession);

  const onLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Admin') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => (
          <Pressable onPress={onLogout} style={{ marginRight: 16 }}>
            <MaterialIcons name="logout" size={22} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="admin1"
        options={{
          title: 'Admin1',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin2"
        options={{
          title: 'Admin2',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="groups" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin3"
        options={{
          title: 'Admin3',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
