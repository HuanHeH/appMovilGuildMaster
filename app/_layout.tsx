import '../global.css';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

import { Stack } from 'expo-router';

import { guildMasterTheme } from '@/lib/guildmaster-theme';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={guildMasterTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000000' } }} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
