import '../global.css';
import '@/lib/nativewind-paper';
import { StatusBar } from 'expo-status-bar';
import { Appearance, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

import { Stack } from 'expo-router';

import { GM, guildMasterTheme } from '@/lib/guildmaster-theme';

// Force dark UI (guarded: static web export SSR has no setColorScheme).
if (typeof Appearance.setColorScheme === 'function') {
  Appearance.setColorScheme('dark');
}

export default function Layout() {
  return (
    <View style={{ flex: 1, height: '100%', maxHeight: '100%', overflow: 'hidden', backgroundColor: GM.black }}>
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
