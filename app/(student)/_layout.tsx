import { Redirect, Tabs, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { Chip, Icon, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GM, headerStyle, tabScreenOptions } from '@/lib/guildmaster-theme';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';

function StudentHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);

  const onLogout = () => {
    clearSession();
    useCharacterStore.getState().setSelectedCharacterId(null);
    useCharacterStore.getState().setCharacters([]);
    router.replace('/login');
  };

  return (
    <View style={{ ...headerStyle, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleMedium" style={{ flexShrink: 1, fontWeight: '700', color: GM.primary }}>
          Student GuildMaster
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Chip compact icon="account">
            {session?.name ?? 'Unknown'}
          </Chip>
          <IconButton icon="logout" onPress={onLogout} accessibilityLabel="Logout" />
        </View>
      </View>

      {selectedCharacter ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Chip compact icon="sword-cross">
            {`${selectedCharacter.name} · ${selectedCharacter.job} · Lv.${selectedCharacter.level} · ${selectedCharacter.exp} EXP`}
          </Chip>
        </View>
      ) : null}
    </View>
  );
}

export default function StudentTabsLayout() {
  const role = useAuthStore((state) => state.session?.role);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);

  const requireCharacter = (e: { preventDefault: () => void }) => {
    if (!selectedCharacterId) {
      e.preventDefault();
      Alert.alert('Select a character');
    }
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Student') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        ...tabScreenOptions,
        header: () => <StudentHeader />,
      }}>
      <Tabs.Screen
        name="alumno1"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Icon source="account" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="alumno2"
        options={{
          title: 'Skills',
          tabBarIcon: ({ color, size }) => <Icon source="sword" color={color} size={size} />,
        }}
        listeners={{ tabPress: requireCharacter }}
      />
      <Tabs.Screen
        name="alumno3"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Icon source="calendar" color={color} size={size} />,
        }}
        listeners={{ tabPress: requireCharacter }}
      />
    </Tabs>
  );
}
