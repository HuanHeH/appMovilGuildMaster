import { Redirect, Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Chip, Icon, IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppSidebar } from '@/components/AppSidebar';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { ChangeUsernameModal } from '@/components/ChangeUsernameModal';
import { SettingsMenuModal } from '@/components/SettingsMenuModal';
import { logout } from '@/lib/api';
import { showAlert } from '@/lib/alert';
import { GM, headerClass, tabScreenOptions } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';

function StudentHeader({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const session = useAuthStore((state) => state.session);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);

  return (
    <View className={headerClass} style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between">
        <Text
          variant="titleMedium"
          className="gm-text-title-primary shrink"
          style={{ color: GM.primary, fontWeight: '700' }}>
          Student GuildMaster
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Chip compact icon="account">
            {session?.name ?? 'Unknown'}
          </Chip>
          <IconButton
            icon="cog"
            onPress={onOpenSettings}
            accessibilityLabel="Settings"
          />
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
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const session = useAuthStore((state) => state.session);
  const role = session?.role;
  const clearSession = useAuthStore((state) => state.clearSession);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [usernameVisible, setUsernameVisible] = useState(false);

  const requireCharacter = (e: { preventDefault: () => void }) => {
    if (!selectedCharacterId) {
      e.preventDefault();
      showAlert('Select a character', 'Please select a character in the Profile tab first.');
    }
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      // Clear the local session even if the server is unavailable.
    } finally {
      clearSession();
      useCharacterStore.getState().setSelectedCharacterId(null);
      useCharacterStore.getState().setCharacters([]);
      router.replace('/login');
    }
  };

  if (!role) return <Redirect href="/login" />;
  if (role !== 'Student') return <Redirect href="/" />;

  const contextLabel = selectedCharacter
    ? `${selectedCharacter.name} · ${selectedCharacter.job} · Lv.${selectedCharacter.level} · ${selectedCharacter.exp} EXP`
    : null;

  return (
    <Tabs
      tabBar={
        isDesktop
          ? (props) => (
              <AppSidebar
                {...props}
                brandTitle="Student GuildMaster"
                contextLabel={contextLabel}
                contextIcon="sword-cross"
                userName={session?.name}
                onLogout={onLogout}
                onChangePassword={() => setSettingsVisible(true)}
              />
            )
          : undefined
      }
      screenOptions={{
        ...tabScreenOptions,
        header: () => <StudentHeader onOpenSettings={() => setSettingsVisible(true)} />,
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
        name="alumno1"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon source="account" color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="alumno2"
        options={{
          title: 'Skills',
          tabBarIcon: ({ color, size }) => (
            <Icon source="sword" color={String(color)} size={size} />
          ),
        }}
        listeners={{ tabPress: requireCharacter }}
      />
      <Tabs.Screen
        name="alumno3"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => (
            <Icon source="calendar" color={String(color)} size={size} />
          ),
        }}
        listeners={{ tabPress: requireCharacter }}
      />
      <SettingsMenuModal
        visible={settingsVisible}
        onDismiss={() => setSettingsVisible(false)}
        onChangeUsername={() => setUsernameVisible(true)}
        onLogout={onLogout}
      />
      <ChangeUsernameModal
        visible={usernameVisible}
        onDismiss={() => setUsernameVisible(false)}
      />
    </Tabs>
  );
}
