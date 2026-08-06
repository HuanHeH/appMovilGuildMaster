import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function Admin1Screen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Stack.Screen options={{ title: 'Admin1' }} />
      <Text variant="headlineSmall">Admin1 (template)</Text>
    </View>
  );
}

