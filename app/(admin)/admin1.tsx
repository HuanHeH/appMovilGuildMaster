import { Stack } from 'expo-router';
import { View } from 'react-native';
import { centerScreenBg } from '@/lib/guildmaster-theme';
import { Text } from 'react-native-paper';

export default function Admin1Screen() {
  return (
    <View style={[centerScreenBg, { paddingHorizontal: 24 }]}>
      <Stack.Screen options={{ title: 'Admin1' }} />
      <Text variant="headlineSmall">Admin1 (template)</Text>
    </View>
  );
}

