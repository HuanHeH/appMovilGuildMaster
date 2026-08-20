import { Stack } from 'expo-router';
import { View } from 'react-native';
import { screenPadClass } from '@/lib/guildmaster-theme';
import { Text } from 'react-native-paper';

export default function Admin2Screen() {
  return (
    <View className={screenPadClass}>
      <Stack.Screen options={{ title: 'Admin2' }} />
      <Text variant="headlineSmall">Admin2 (template)</Text>
    </View>
  );
}

