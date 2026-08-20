import { Redirect } from 'expo-router';
import { ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';

import { useAuthStore } from '@/store/auth-store';

export default function RootIndex() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const role = useAuthStore((state) => state.session?.role);

  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', minHeight: '100vh' }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!role) {
    return <Redirect href="/login" />;
  }

  if (role === 'Admin') {
    return <Redirect href="/login" />;
  }
  if (role === 'Teacher') {
    return <Redirect href="/(teacher)/profe1" />;
  }
  if (role === 'Student') {
    return <Redirect href="/(student)/alumno1" />;
  }
}
