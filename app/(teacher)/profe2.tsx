import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function Profe2Screen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Stack.Screen options={{ title: 'Profe2' }} />
      <Text variant="headlineSmall">Profe2 (plantilla)</Text>
    </View>
  );
}

