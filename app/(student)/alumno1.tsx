import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function Alumno1Screen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Stack.Screen options={{ title: 'Alumno1' }} />
      <Text variant="headlineSmall">Alumno1 (plantilla)</Text>
    </View>
  );
}

