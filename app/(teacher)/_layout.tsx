import { Redirect, Tabs, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable } from 'react-native';

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
          <Pressable onPress={onLogout} style={{ marginRight: 16 }}>
            <MaterialIcons name="logout" size={22} />
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="profe1"
        options={{
          title: 'Profe1',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="groups" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profe2"
        options={{
          title: 'Profe2',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profe3"
        options={{
          title: 'Profe3',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="event" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

