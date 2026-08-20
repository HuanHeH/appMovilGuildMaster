import '../global.css';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';

import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <View style={{ flex: 1, minHeight: '100vh' }}>
      <SafeAreaProvider>
        <PaperProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </PaperProvider>
      </SafeAreaProvider>
    </View>
  );
}
