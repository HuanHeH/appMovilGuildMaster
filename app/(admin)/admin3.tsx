import { Stack } from 'expo-router';
import { View } from 'react-native';
import { screenPadClass } from '@/lib/guildmaster-theme';
import { Text } from 'react-native-paper';

export default function Admin3Screen() {
  return (
    <View className={screenPadClass}>
      <Stack.Screen options={{ title: 'Admin3' }} />
      <Text variant="headlineSmall">Admin3 (template)</Text>
    </View>
  );
}

