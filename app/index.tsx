import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';

export default function RootIndex() {
  const role = useAuthStore((state) => state.session?.role);

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
