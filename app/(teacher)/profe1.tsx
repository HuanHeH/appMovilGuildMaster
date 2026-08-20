import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, List, Snackbar, Text, TouchableRipple } from 'react-native-paper';

import { useAuthStore } from '@/store/auth-store';
import { selectSelectedGuild, useGuildStore } from '@/store/guild-store';
import { guildLabel } from '@/types/game';

export default function TeacherGuildsScreen() {
  const session = useAuthStore((state) => state.session);
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);
  const setSelectedGuildId = useGuildStore((state) => state.setSelectedGuildId);
  const guilds = useGuildStore((state) => state.guilds);
  const refreshGuilds = useGuildStore((state) => state.refreshGuilds);
  const selectedGuild = useGuildStore(selectSelectedGuild);

  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card mode="outlined">
          <Card.Content style={{ gap: 4 }}>
            <Text variant="titleMedium">User</Text>
            <Text>{session?.name}</Text>
            <Text>{session?.mail}</Text>
          </Card.Content>
        </Card>

        <Card mode="contained">
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">Your mentorship guilds</Text>
            <Text>{selectedLabel}</Text>

            {!guilds.length ? (
              <Text>No mentorship guilds found.</Text>
            ) : (
              guilds.map((guild) => {
                const selected = guild.id === selectedGuildId;
                return (
                  <TouchableRipple
                    key={guild.id}
                    onPress={() => setSelectedGuildId(guild.id)}
                    style={{
                      borderWidth: 1,
                      borderColor: selected ? '#ef4444' : '#d1d5db',
                      borderRadius: 10,
                      backgroundColor: selected ? '#fef2f2' : 'white',
                    }}>
                    <List.Item
                      title={guild.name}
                      description={guildLabel(guild)}
                      left={(props) => (
                        <List.Icon {...props} icon={selected ? 'check-circle' : 'school'} />
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
