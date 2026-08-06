import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, List, Snackbar, Text, TouchableRipple } from 'react-native-paper';

import { getGuilds } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';
import type { Guild } from '@/types/game';
import { guildLabel } from '@/types/game';

export default function ProfileScreen() {
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card mode="outlined">
          <Card.Content style={{ gap: 4 }}>
            <Text variant="titleMedium">User</Text>
            <Text>{session?.name}</Text>
            <Text>{session?.mail}</Text>
            <Text>Role: {session?.role}</Text>
          </Card.Content>
        </Card>

        <Card mode="contained">
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">Your characters</Text>
            <Text>{selectedLabel}</Text>

            {!characters.length ? (
              <Text>No characters found for this user.</Text>
            ) : (
              characters.map((character) => {
                const selected = character.id === selectedCharacterId;
                const guild = guilds.find((g) => g.id === character.guild_id);
                return (
                  <TouchableRipple
                    key={character.id}
                    onPress={() => setSelectedCharacterId(character.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? '#ef4444' : '#d1d5db',
                      borderRadius: 10,
                      backgroundColor: selected ? '#fef2f2' : 'white',
                    }}>
                    <List.Item
                      title={`${character.id}. ${character.name}`}
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
