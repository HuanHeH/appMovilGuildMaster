import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, List, Snackbar, Text, TouchableRipple } from 'react-native-paper';

import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
  DesktopListRow,
} from '@/components/DesktopListRow';
import { getGuilds } from '@/lib/api';
import { centerScreenClass, GM, screenClass, selectedRowClass } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';
import type { Guild } from '@/types/game';
import { guildLabel } from '@/types/game';

const CHARACTER_COLS = [
  { key: 'name', label: 'Character', flex: 1.4 },
  { key: 'job', label: 'Job', flex: 0.9 },
  { key: 'level', label: 'Level', flex: 0.55, minWidth: 64 },
  { key: 'exp', label: 'EXP', flex: 0.55, minWidth: 64 },
  { key: 'guild', label: 'Guild', flex: 1.6 },
];

export default function ProfileScreen() {
  const isDesktop = useIsDesktop();
  const session = useAuthStore((state) => state.session);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const setSelectedCharacterId = useCharacterStore((state) => state.setSelectedCharacterId);
  const characters = useCharacterStore((state) => state.characters);
  const refreshCharacters = useCharacterStore((state) => state.refreshCharacters);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);

  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session) return;
        setLoading(true);
        try {
          const [, guildData] = await Promise.all([refreshCharacters(), getGuilds()]);
          if (!active) return;
          setGuilds(guildData);
        } catch {
          if (active) setSnackbar('Could not load profile data.');
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => {
        active = false;
      };
    }, [session, refreshCharacters])
  );

  const selectedLabel = useMemo(() => {
    if (!selectedCharacter) return 'No character selected yet.';
    return `Active: ${selectedCharacter.name} (${selectedCharacter.job} Lv.${selectedCharacter.level}, EXP ${selectedCharacter.exp}).`;
  }, [selectedCharacter]);

  if (loading && !characters.length) {
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
            <Text variant="titleMedium">Your characters</Text>
            <Text>{selectedLabel}</Text>

            {!characters.length ? (
              <Text>No characters found for this user.</Text>
            ) : isDesktop ? (
              <View style={{ gap: 6, marginTop: 4 }}>
                <DesktopListHeader columns={CHARACTER_COLS} />
                {characters.map((character) => {
                  const selected = character.id === selectedCharacterId;
                  const guild = guilds.find((g) => g.id === character.guild_id);
                  return (
                    <DesktopListRow
                      key={character.id}
                      selected={selected}
                      onPress={() => setSelectedCharacterId(character.id)}>
                      <DesktopCell flex={1.4}>
                        <DesktopCellText
                          primary={character.name}
                          secondary={selected ? 'Selected' : null}
                          secondaryStyle={selected ? { color: GM.primary } : undefined}
                        />
                      </DesktopCell>
                      <DesktopCell flex={0.9}>
                        <DesktopCellText primary={character.job} />
                      </DesktopCell>
                      <DesktopCell flex={0.55} minWidth={64}>
                        <DesktopCellText primary={`Lv.${character.level}`} />
                      </DesktopCell>
                      <DesktopCell flex={0.55} minWidth={64}>
                        <DesktopCellText primary={String(character.exp)} />
                      </DesktopCell>
                      <DesktopCell flex={1.6}>
                        <DesktopCellText primary={guildLabel(guild)} />
                      </DesktopCell>
                    </DesktopListRow>
                  );
                })}
              </View>
            ) : (
              characters.map((character) => {
                const selected = character.id === selectedCharacterId;
                const guild = guilds.find((g) => g.id === character.guild_id);
                return (
                  <TouchableRipple
                    key={character.id}
                    onPress={() => setSelectedCharacterId(character.id)}
                    className={selectedRowClass(selected)}>
                    <List.Item
                      title={character.name}
                      description={`${character.job} | Lv.${character.level} | EXP ${character.exp}\n${guildLabel(guild)}`}
                      left={(props) => (
                        <List.Icon {...props} icon={selected ? 'check-circle' : 'account'} />
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
    </View>
  );
}
