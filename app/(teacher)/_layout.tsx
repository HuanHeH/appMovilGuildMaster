import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Chip, Icon, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logout } from '@/lib/api';
import { showAlert } from '@/lib/alert';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedGuild, useGuildStore } from '@/store/guild-store';
import { guildLabel } from '@/types/game';

function TeacherHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setSelectedGuildId = useGuildStore((state) => state.setSelectedGuildId);
  const refreshGuilds = useGuildStore((state) => state.refreshGuilds);
  const selectedGuild = useGuildStore(selectSelectedGuild);

  useEffect(() => {
    if (!session) return;
    refreshGuilds().catch(() => undefined);
  }, [session?.id, refreshGuilds]);

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear the local session even if the server is unavailable.
    } finally {
      clearSession();
      setSelectedGuildId(null);
      useGuildStore.getState().setGuilds([]);
      router.replace('/login');
    }
  };

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: 12,
        paddingBottom: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        gap: 8,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="titleMedium" style={{ flexShrink: 1, fontWeight: '700' }}>
          Teacher GuildMaster
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Chip compact icon="account">
            {session?.name ?? 'Unknown'}
          </Chip>
          <IconButton icon="logout" onPress={onLogout} accessibilityLabel="Logout" />
        </View>
      </View>

      {selectedGuild ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Chip compact icon="school">
            {guildLabel(selectedGuild)}
          </Chip>
        </View>
      ) : null}
    </View>
  );
}

export default function TeacherTabsLayout() {
  const role = useAuthStore((state) => state.session?.role);
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);

  const requireGuild = (e: { preventDefault: () => void }) => {
    if (!selectedGuildId) {
      e.preventDefault();
      showAlert('Select a guild', 'Please select a guild in the Guilds tab first.');
    }
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Teacher') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{
        header: () => <TeacherHeader />,
      }}>
      <Tabs.Screen
        name="profe1"
        options={{
          title: 'Guilds',
          tabBarIcon: ({ color, size }) => <Icon source="school" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profe2"
        options={{
          title: 'Skills',
          tabBarIcon: ({ color, size }) => <Icon source="sword" color={color} size={size} />,
        }}
        listeners={{ tabPress: requireGuild }}
      />
      <Tabs.Screen
        name="profe3"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => <Icon source="calendar" color={color} size={size} />,
        }}
        listeners={{ tabPress: requireGuild }}
      />
    </Tabs>
  );
}
