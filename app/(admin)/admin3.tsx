import { Stack } from 'expo-router';
import { View } from 'react-native';
import { centerScreenBg } from '@/lib/guildmaster-theme';
import { Text } from 'react-native-paper';

export default function Admin3Screen() {
  return (
    <View style={[centerScreenBg, { paddingHorizontal: 24 }]}>
      <Stack.Screen options={{ title: 'Admin3' }} />
      <Text variant="headlineSmall">Admin3 (template)</Text>
    </View>
  );
}

