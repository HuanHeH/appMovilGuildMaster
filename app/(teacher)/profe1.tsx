import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, IconButton, List, Snackbar, Text, TouchableRipple } from 'react-native-paper';

import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
  DesktopListRow,
} from '@/components/DesktopListRow';
import { RenameGuildModal } from '@/components/RenameGuildModal';
import { centerScreenClass, GM, screenClass, selectedRowClass } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedGuild, useGuildStore } from '@/store/guild-store';
import { guildClassLabel, guildLabel } from '@/types/game';

const GUILD_COLS = [
  { key: 'name', label: 'Guild', flex: 1.4 },
  { key: 'class', label: 'Class', flex: 1.2 },
  { key: 'level', label: 'Level', flex: 0.9 },
  { key: 'modality', label: 'Modality', flex: 1 },
  { key: 'group', label: 'Group', flex: 0.7, minWidth: 72 },
];

export default function TeacherGuildsScreen() {
  const isDesktop = useIsDesktop();
  const session = useAuthStore((state) => state.session);
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);
  const setSelectedGuildId = useGuildStore((state) => state.setSelectedGuildId);
  const guilds = useGuildStore((state) => state.guilds);
  const refreshGuilds = useGuildStore((state) => state.refreshGuilds);
  const selectedGuild = useGuildStore(selectSelectedGuild);

  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');
  const [renameModal, setRenameModal] = useState<{ guildId: number; guildName: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session) return;
        setLoading(true);
        try {
          await refreshGuilds();
        } catch {
          if (active) setSnackbar('Could not load mentorship guilds.');
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => {
        active = false;
      };
    }, [session, refreshGuilds])
  );

  const selectedLabel = useMemo(() => {
    if (!selectedGuild) return 'No guild selected yet.';
    return `Active: ${guildLabel(selectedGuild)}`;
  }, [selectedGuild]);

  if (loading && !guilds.length) {
    return (
      <View className={centerScreenClass}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className={screenClass}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card mode="outlined">
          <Card.Content
            style={
              isDesktop
                ? { flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap' }
                : { gap: 4 }
            }>
            <Text variant="titleMedium" style={{ color: GM.primary, fontWeight: '700' }}>
              User
            </Text>
            <Text>{session?.name}</Text>
            <Text style={{ color: GM.tertiary }}>{session?.mail}</Text>
          </Card.Content>
        </Card>

        <Card mode="contained">
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">Your mentorship guilds</Text>
            <Text>{selectedLabel}</Text>

            {!guilds.length ? (
              <Text>No mentorship guilds found.</Text>
            ) : isDesktop ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <DesktopListHeader columns={GUILD_COLS} />
                {guilds.map((guild) => {
                  const selected = guild.id === selectedGuildId;
                  return (
                    <View key={guild.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <DesktopListRow
                          selected={selected}
                          onPress={() => setSelectedGuildId(guild.id)}
                          onLongPress={() => setRenameModal({ guildId: guild.id, guildName: guild.name })}>
                          <DesktopCell flex={1.4}>
                            <DesktopCellText
                              primary={guild.name}
                              secondary={selected ? 'Selected' : null}
                              secondaryStyle={selected ? { color: GM.selectedText } : undefined}
                            />
                          </DesktopCell>
                          <DesktopCell flex={1.2}>
                            <DesktopCellText primary={guildClassLabel(guild)} />
                          </DesktopCell>
                          <DesktopCell flex={0.9}>
                            <DesktopCellText primary={guild.level ?? '—'} />
                          </DesktopCell>
                          <DesktopCell flex={1}>
                            <DesktopCellText primary={guild.modality ?? '—'} />
                          </DesktopCell>
                          <DesktopCell flex={0.7} minWidth={72}>
                            <DesktopCellText primary={`${guild.number}${guild.letter}`} />
                          </DesktopCell>
                        </DesktopListRow>
                      </View>
                      <IconButton
                        icon="pencil"
                        size={18}
                        onPress={() => setRenameModal({ guildId: guild.id, guildName: guild.name })}
                        accessibilityLabel="Rename guild"
                      />
                    </View>
                  );
                })}
              </View>
            ) : (
              guilds.map((guild) => {
                const selected = guild.id === selectedGuildId;
                return (
                  <TouchableRipple
                    key={guild.id}
                    onPress={() => setSelectedGuildId(guild.id)}
                    onLongPress={() => setRenameModal({ guildId: guild.id, guildName: guild.name })}
                    className={selectedRowClass(selected)}>
                    <List.Item
                      title={guild.name}
                      description={guildLabel(guild)}
                      titleStyle={selected ? { color: GM.selectedText } : undefined}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={selected ? 'check-circle' : 'school'}
                          color={selected ? GM.selectedBorder : props.color}
                        />
                      )}
                      right={(props) => (
                        <List.Icon {...props} icon="pencil" color={GM.tertiary} />
                      )}
                    />
                  </TouchableRipple>
                );
              })
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={2500}>
        {snackbar}
      </Snackbar>

      <RenameGuildModal
        guildId={renameModal?.guildId ?? null}
        guildName={renameModal?.guildName ?? ''}
        visible={renameModal !== null}
        onDismiss={() => setRenameModal(null)}
        onRenamed={(newName) => {
          if (renameModal) {
            const updated = guilds.map((g) =>
              g.id === renameModal.guildId ? { ...g, name: newName } : g
            );
            useGuildStore.setState({ guilds: updated });
          }
        }}
      />
    </View>
  );
}
