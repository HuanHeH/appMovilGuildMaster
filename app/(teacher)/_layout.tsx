import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Chip, Icon, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSidebar } from '@/components/AppSidebar';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { logout } from '@/lib/api';
import { showAlert } from '@/lib/alert';
import { GM, headerClass, tabScreenOptions } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
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
  const [pwModalVisible, setPwModalVisible] = useState(false);

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
    <View className={headerClass} style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between">
        <Text
          variant="titleMedium"
          className="gm-text-title-primary shrink"
          style={{ color: GM.primary, fontWeight: '700' }}>
          Teacher GuildMaster
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Chip compact icon="account">
            {session?.name ?? 'Unknown'}
          </Chip>
          <IconButton icon="lock-reset" onPress={() => setPwModalVisible(true)} accessibilityLabel="Change password" />
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
      <ChangePasswordModal visible={pwModalVisible} onDismiss={() => setPwModalVisible(false)} />
    </View>
  );
}

export default function TeacherTabsLayout() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const session = useAuthStore((state) => state.session);
  const role = session?.role;
  const clearSession = useAuthStore((state) => state.clearSession);
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);
  const selectedGuild = useGuildStore(selectSelectedGuild);
  const setSelectedGuildId = useGuildStore((state) => state.setSelectedGuildId);
  const refreshGuilds = useGuildStore((state) => state.refreshGuilds);
  const [pwModalVisible, setPwModalVisible] = useState(false);

  useEffect(() => {
    if (!session || !isDesktop) return;
    refreshGuilds().catch(() => undefined);
  }, [session?.id, isDesktop, refreshGuilds]);

  const requireGuild = (e: { preventDefault: () => void }) => {
    if (!selectedGuildId) {
      e.preventDefault();
      showAlert('Select a guild', 'Please select a guild in the Guilds tab first.');
    }
  };

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

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Teacher') return <Redirect href="/" />;

  const contextLabel = selectedGuild ? guildLabel(selectedGuild) : null;

  return (
    <Tabs
      tabBar={
        isDesktop
          ? (props) => (
              <AppSidebar
                {...props}
                brandTitle="Teacher GuildMaster"
                contextLabel={contextLabel}
                contextIcon="school"
                userName={session?.name}
                onLogout={onLogout}
                onChangePassword={() => setPwModalVisible(true)}
              />
            )
          : undefined
      }
      screenOptions={{
        ...tabScreenOptions,
        header: () => <TeacherHeader />,
        headerShown: !isDesktop,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarStyle: isDesktop
          ? {
              backgroundColor: GM.surfaceContainer,
              borderTopWidth: 0,
              borderRightWidth: 0,
              elevation: 0,
              width: 240,
            }
          : tabScreenOptions.tabBarStyle,
      }}>
      <Tabs.Screen
        name="profe1"
        options={{
          title: 'Guilds',
          tabBarIcon: ({ color, size }) => (
            <Icon source="school" color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profe2"
        options={{
          title: 'Skills',
          tabBarIcon: ({ color, size }) => (
            <Icon source="sword" color={String(color)} size={size} />
          ),
        }}
        listeners={{ tabPress: requireGuild }}
      />
      <Tabs.Screen
        name="profe3"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar" color={String(color)} size={size} />
          ),
        }}
        listeners={{ tabPress: requireGuild }}
      />
      <ChangePasswordModal visible={pwModalVisible} onDismiss={() => setPwModalVisible(false)} />
    </Tabs>
  );
}
