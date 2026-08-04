import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

export default function Alumno3Screen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Stack.Screen options={{ title: 'Alumno3' }} />
      <Text variant="headlineSmall">Alumno3 (plantilla)</Text>
    </View>
  );
}

