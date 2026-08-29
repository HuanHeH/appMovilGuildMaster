import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Divider,
  IconButton,
  Modal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
  DesktopListRow,
} from '@/components/DesktopListRow';
import {
  apiErrorMessage,
  getCharacters,
  getEvents,
  getParties,
  getUsers,
  updateCharacterName,
} from '@/lib/api';
import { GM, screenClass } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useGuildStore } from '@/store/guild-store';
import type { Character, GameEvent, Party, UserPublic } from '@/types/game';

const CHAR_COLS = [
  { key: 'name', label: 'Character', flex: 1.2 },
  { key: 'user', label: 'User', flex: 1 },
  { key: 'job', label: 'Class', flex: 0.8 },
  { key: 'level', label: 'Level', flex: 0.5 },
  { key: 'exp', label: 'EXP', flex: 0.5 },
  { key: 'party', label: 'Party', flex: 1 },
  { key: 'events', label: 'Events', flex: 0.5 },
  { key: 'actions', label: '', flex: 0.4 },
];

export default function TeacherCharactersScreen() {
  const isDesktop = useIsDesktop();
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);
  const theme = useTheme();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');
  const [renameModal, setRenameModal] = useState<{ id: number; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const eventCountByCharacter = useMemo(() => {
    const counts = new Map<number, number>();
    for (const event of events) {
      if (event.target_character_id != null) {
        counts.set(event.target_character_id, (counts.get(event.target_character_id) ?? 0) + 1);
      }
      if (event.caster_character_id != null) {
        counts.set(event.caster_character_id, (counts.get(event.caster_character_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [events]);

  const reload = useCallback(async () => {
    if (!selectedGuildId) return;
    const [chars, usersData, partiesData, eventsData] = await Promise.all([
      getCharacters(selectedGuildId),
      getUsers(selectedGuildId),
      getParties(selectedGuildId),
      getEvents(selectedGuildId),
    ]);
    setCharacters(chars);
    setUsers(usersData);
    setParties(partiesData);
    setEvents(eventsData);
  }, [selectedGuildId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!selectedGuildId) return;
        setLoading(true);
        try {
          await reload();
        } catch (error) {
          if (active) setSnackbar(apiErrorMessage(error, 'Could not load characters.'));
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [reload, selectedGuildId])
  );

  const openRename = (char: Character) => {
    setRenameModal({ id: char.id, name: char.name });
    setNewName(char.name);
  };
  const submitRename = async () => {
    if (!renameModal) return;
    const trimmed = newName.trim();
    if (!trimmed) { setSnackbar('Name is required.'); return; }
    if (trimmed === renameModal.name) { setRenameModal(null); return; }
    try {
      setSubmitting(true);
      await updateCharacterName(renameModal.id, trimmed);
      setSnackbar('Character renamed.');
      setRenameModal(null);
      await reload();
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not rename character.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedGuildId) return <Redirect href="/(teacher)/profe1" />;
  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text variant="titleMedium" style={{ color: GM.primary, fontWeight: '700' }}>
          Characters ({characters.length})
        </Text>

        {characters.length === 0 ? (
          <Card mode="outlined"><Card.Content><Text style={{ color: GM.tertiary }}>No characters in this guild.</Text></Card.Content></Card>
        ) : isDesktop ? (
          <View style={{ gap: 6 }}>
            <DesktopListHeader columns={CHAR_COLS} />
            {characters.map((char) => {
              const owner = userById.get(char.user_id)?.name ?? 'Unknown';
              const partyName = char.party_id ? partyById.get(char.party_id)?.name ?? '—' : 'Free Agent';
              const eventCount = eventCountByCharacter.get(char.id) ?? 0;
              return (
                <View key={char.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <DesktopListRow>
                      <DesktopCell flex={1.2}><DesktopCellText primary={char.name} /></DesktopCell>
                      <DesktopCell flex={1}><DesktopCellText primary={owner} /></DesktopCell>
                      <DesktopCell flex={0.8}><DesktopCellText primary={char.job ?? 'No class'} /></DesktopCell>
                      <DesktopCell flex={0.5}><DesktopCellText primary={String(char.level)} /></DesktopCell>
                      <DesktopCell flex={0.5}><DesktopCellText primary={String(char.exp)} /></DesktopCell>
                      <DesktopCell flex={1}><DesktopCellText primary={partyName} /></DesktopCell>
                      <DesktopCell flex={0.5}><DesktopCellText primary={String(eventCount)} /></DesktopCell>
                    </DesktopListRow>
                  </View>
                  <IconButton icon="pencil" size={18} onPress={() => openRename(char)} accessibilityLabel="Rename character" />
                </View>
              );
            })}
          </View>
        ) : (
          characters.map((char) => {
            const owner = userById.get(char.user_id)?.name ?? 'Unknown';
            const partyName = char.party_id ? partyById.get(char.party_id)?.name ?? '—' : 'Free Agent';
            const eventCount = eventCountByCharacter.get(char.id) ?? 0;
            return (
              <Card key={char.id} mode="outlined">
                <Card.Content style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>{char.name}</Text>
                    <IconButton icon="pencil" size={18} onPress={() => openRename(char)} accessibilityLabel="Rename" />
                  </View>
                  <Text style={{ color: GM.onSurfaceVariant }}>{char.job ?? 'No class'} · {owner}</Text>
                  <Text style={{ color: GM.tertiary }}>Lv.{char.level} · {char.exp} EXP · {partyName} · {eventCount} events</Text>
                </Card.Content>
              </Card>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={renameModal !== null}
        onDismiss={() => setRenameModal(null)}
        contentContainerStyle={{ margin: 16, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 12 }}>Rename character</Text>
        <TextInput mode="outlined" label="New name" value={newName} onChangeText={setNewName} maxLength={100} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Button onPress={() => setRenameModal(null)}>Cancel</Button>
          <Button mode="contained" loading={submitting} disabled={submitting} onPress={submitRename}>Save</Button>
        </View>
      </Modal>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3000}>{snackbar}</Snackbar>
    </View>
  );
}
