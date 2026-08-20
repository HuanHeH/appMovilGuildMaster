import { Stack } from 'expo-router';
import { View } from 'react-native';
import { screenPadClass } from '@/lib/guildmaster-theme';
import { Text } from 'react-native-paper';

export default function Admin1Screen() {
  return (
    <View className={screenPadClass}>
      <Stack.Screen options={{ title: 'Admin1' }} />
      <Text variant="headlineSmall">Admin1 (template)</Text>
    </View>
  );
}

