import { useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { ActivityIndicator, Button, HelperText, Icon, Text, TextInput } from 'react-native-paper';

import { login } from '@/lib/api';
import { GM } from '@/lib/guildmaster-theme';
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
      const status = err?.response?.status as number | undefined;
      const code = err?.code as string | undefined;
      if (!err?.response && (code === 'ERR_NETWORK' || code === 'ECONNABORTED' || !status)) {
        setError('No connection. Check your network or that the API is running.');
      } else if (status === 401 || status === 403) {
        setError('Invalid mail or password.');
      } else if (status === 400) {
        setError('Invalid login data.');
      } else if (status && status >= 500) {
        setError('Server error. Try again later.');
      } else {
        setError('Could not sign in. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="gm-screen-pad">
      <Stack.Screen options={{ title: 'Login', headerShown: false }} />
      <View className="gm-login-glow" pointerEvents="none" />
      <View className="gm-login-form">
        <View className="gm-login-brand">
          <Icon source="sword-cross" size={56} color={GM.primaryContainer} />
          <Text variant="headlineMedium" className="gm-text-on-bg text-center">
            GuildMaster{'\n'}Mobile
          </Text>
        </View>
        <TextInput
          mode="outlined"
          label="Mail"
          value={mail}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setMail}
          className="gm-input-inverse"
          textColor={GM.inverseOnSurface}
        />
        <TextInput
          mode="outlined"
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className="gm-input-inverse"
          textColor={GM.inverseOnSurface}
        />
        <HelperText type="error" visible={!!error}>
          {error ?? ''}
        </HelperText>
        <Button
          mode="contained"
          buttonColor={GM.primaryContainer}
          textColor={GM.onPrimary}
          onPress={onLogin}
          disabled={loading}
          style={{ marginTop: 4 }}>
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
        {loading ? <ActivityIndicator animating size="small" color={GM.primary} /> : null}
      </View>
    </View>
  );
}
