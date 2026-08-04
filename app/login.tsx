import { useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Text, TextInput } from 'react-native-paper';

import { login } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

export default function LoginScreen() {
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);

  const [mail, setMail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.role === 'Admin') return <Redirect href="/(admin)/admin1" />;
  if (session?.role === 'Teacher') return <Redirect href="/(teacher)/profe1" />;
  if (session?.role === 'Student') return <Redirect href="/(student)/alumno1" />;

  const onLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await login(mail.trim(), password);
      setSession({
        id: response.id,
        name: response.name,
        mail: response.mail,
        role: response.role,
        accessToken: response.access_token,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Stack.Screen options={{ title: 'Login', headerShown: false }} />
      <View className="w-full max-w-md gap-3">
        <Text variant="headlineMedium">GuildMaster Mobile</Text>
        <Text variant="bodyMedium">
          Login with your API account. Access is role-based (Student / Teacher / Admin).
        </Text>
        <TextInput
          mode="outlined"
          label="Mail"
          value={mail}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setMail}
        />
        <TextInput
          mode="outlined"
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <HelperText type="error" visible={!!error}>
          {error ?? ''}
        </HelperText>
        <Button mode="contained" onPress={onLogin} disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
        {loading ? <ActivityIndicator animating size="small" /> : null}
      </View>
    </View>
  );
}
