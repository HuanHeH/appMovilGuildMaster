import '../global.css';
import '@/lib/nativewind-paper';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

import { Stack } from 'expo-router';

import { GM, guildMasterTheme } from '@/lib/guildmaster-theme';

export default function Layout() {
  return (
    <View style={{ flex: 1, minHeight: '100vh' }}>
      <SafeAreaProvider>
        <PaperProvider theme={guildMasterTheme}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: GM.black },
            }}
          />
        </PaperProvider>
      </SafeAreaProvider>
    </View>
  );
}
