import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  List,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';

import {
  apiErrorMessage,
  createParty,
  deleteParty,
  getCharacters,
  getEvents,
  getParties,
  getUsers,
  updateCharacterParty,
  updateParty,
} from '@/lib/api';
import { showConfirm } from '@/lib/alert';
import { GM, screenClass } from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useGuildStore } from '@/store/guild-store';
import type { Character, GameEvent, Party, UserPublic } from '@/types/game';
import { characterOwnerLabel } from '@/types/game';

export default function TeacherPartiesScreen() {
  const isDesktop = useIsDesktop();
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);

  const [parties, setParties] = useState<Party[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');

  const [partyModalVisible, setPartyModalVisible] = useState(false);
  const [partyModalMode, setPartyModalMode] = useState<'create' | 'rename'>('create');
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyName, setPartyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignPartyId, setAssignPartyId] = useState<number | null>(null);
  const [assignCharacterIds, setAssignCharacterIds] = useState<number[]>([]);

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  const freeAgents = useMemo(
    () => characters.filter((c) => c.party_id == null),
    [characters]
  );

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
    const [partiesData, chars, usersData, eventsData] = await Promise.all([
      getParties(selectedGuildId),
      getCharacters(selectedGuildId),
      getUsers(selectedGuildId),
      getEvents(selectedGuildId),
    ]);
    setParties(partiesData);
    setCharacters(chars);
    setUsers(usersData);
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
          if (active) setSnackbar(apiErrorMessage(error, 'Could not load parties.'));
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => { active = false; };
    }, [reload, selectedGuildId])
  );

  const openCreateParty = () => {
    setPartyModalMode('create');
    setEditingParty(null);
    setPartyName('');
    setPartyModalVisible(true);
  };
  const openRenameParty = (party: Party) => {
    setPartyModalMode('rename');
    setEditingParty(party);
    setPartyName(party.name);
    setPartyModalVisible(true);
  };
  const submitParty = async () => {
    if (!selectedGuildId) return;
    const trimmed = partyName.trim();
    if (!trimmed) { setSnackbar('Party name is required.'); return; }
    try {
      setSubmitting(true);
      if (partyModalMode === 'create') {
        await createParty({ name: trimmed, guildId: selectedGuildId });
        setSnackbar('Party created.');
      } else if (editingParty) {
        await updateParty(editingParty.id, { name: trimmed });
        setSnackbar('Party renamed.');
      }
      setPartyModalVisible(false);
      await reload();
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not save party.'));
    } finally {
      setSubmitting(false);
    }
  };
  const handleDeleteParty = (party: Party) => {
    showConfirm('Delete party', `Delete "${party.name}"? Characters will become Free Agents.`, async () => {
      try {
        await deleteParty(party.id);
        setSnackbar('Party deleted.');
        await reload();
      } catch (error) {
        setSnackbar(apiErrorMessage(error, 'Could not delete party.'));
      }
    });
  };
  const openAssignCharacters = (partyId: number) => {
    setAssignPartyId(partyId);
    const assigned = characters.filter((c) => c.party_id === partyId).map((c) => c.id);
    setAssignCharacterIds(assigned);
    setAssignModalVisible(true);
  };
  const toggleAssignCharacter = (id: number) => {
    setAssignCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };
  const submitAssignCharacters = async () => {
    if (assignPartyId === null) return;
    try {
      setSubmitting(true);
      const current = characters.filter((c) => c.party_id === assignPartyId).map((c) => c.id);
      const toRemove = current.filter((id) => !assignCharacterIds.includes(id));
      const toAdd = assignCharacterIds.filter((id) => !current.includes(id));
      for (const id of toRemove) await updateCharacterParty(id, null);
      for (const id of toAdd) await updateCharacterParty(id, assignPartyId);
      setAssignModalVisible(false);
      await reload();
      setSnackbar('Party members updated.');
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not update party members.'));
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="titleMedium" style={{ color: GM.primary, fontWeight: '700' }}>Parties</Text>
          <Button mode="contained" icon="plus" onPress={openCreateParty}>New Party</Button>
        </View>

        {parties.length === 0 ? (
          <Card mode="outlined"><Card.Content><Text style={{ color: GM.tertiary }}>No parties yet. Create one to organize your students.</Text></Card.Content></Card>
        ) : (
          parties.map((party) => {
            const members = characters.filter((c) => c.party_id === party.id);
            return (
              <Card key={party.id} mode="outlined" style={{ backgroundColor: GM.surfaceContainer }}>
                <Card.Content style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <List.Icon icon="account-group" color={GM.primary} />
                      <Text variant="titleMedium" style={{ fontWeight: '700', flexShrink: 1 }}>{party.name}</Text>
                      <IconButton icon="pencil" size={18} onPress={() => openRenameParty(party)} accessibilityLabel="Rename party" />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Chip compact>{members.length} members</Chip>
                      <IconButton icon="account-plus" size={20} onPress={() => openAssignCharacters(party.id)} accessibilityLabel="Assign characters" />
                      <IconButton icon="delete" size={20} iconColor={GM.error} onPress={() => handleDeleteParty(party)} accessibilityLabel="Delete party" />
                    </View>
                  </View>
                  <Divider />
                  {members.length === 0 ? (
                    <Text style={{ color: GM.tertiary, paddingVertical: 8 }}>No members assigned.</Text>
                  ) : (
                    members.map((char) => {
                      const owner = userById.get(char.user_id)?.name ?? 'Unknown';
                      const eventCount = eventCountByCharacter.get(char.id) ?? 0;
                      return (
                        <List.Item
                          key={char.id}
                          title={char.name}
                          description={`${char.job ?? 'No class'} · ${owner} · Lv.${char.level} · ${char.exp} EXP · ${eventCount} events`}
                          left={(props) => <List.Icon {...props} icon="account" />}
                        />
                      );
                    })
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}

        <Card mode="outlined" style={{ backgroundColor: GM.surfaceContainer, borderColor: GM.outline }}>
          <Card.Content style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <List.Icon icon="account-clock" color={GM.tertiary} />
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>Free Agents</Text>
              <Chip compact>{freeAgents.length}</Chip>
            </View>
            <Divider />
            {freeAgents.length === 0 ? (
              <Text style={{ color: GM.tertiary, paddingVertical: 8 }}>All characters are assigned to a party.</Text>
            ) : (
              freeAgents.map((char) => {
                const owner = userById.get(char.user_id)?.name ?? 'Unknown';
                const eventCount = eventCountByCharacter.get(char.id) ?? 0;
                return (
                  <List.Item
                    key={char.id}
                    title={char.name}
                    description={`${char.job ?? 'No class'} · ${owner} · Lv.${char.level} · ${char.exp} EXP · ${eventCount} events`}
                    left={(props) => <List.Icon {...props} icon="account" />}
                  />
                );
              })
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal
        visible={partyModalVisible}
        onDismiss={() => setPartyModalVisible(false)}
        contentContainerStyle={{ margin: 16, backgroundColor: GM.surfaceContainer, borderRadius: 12, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: GM.onSurface, marginBottom: 12 }}>
          {partyModalMode === 'create' ? 'Create party' : 'Rename party'}
        </Text>
        <TextInput mode="outlined" label="Party name" value={partyName} onChangeText={setPartyName} maxLength={80} />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Button onPress={() => setPartyModalVisible(false)}>Cancel</Button>
          <Button mode="contained" loading={submitting} disabled={submitting} onPress={submitParty}>
            {partyModalMode === 'create' ? 'Create' : 'Save'}
          </Button>
        </View>
      </Modal>

      <Modal
        visible={assignModalVisible}
        onDismiss={() => setAssignModalVisible(false)}
        contentContainerStyle={{ margin: 16, backgroundColor: GM.surfaceContainer, borderRadius: 12, padding: 20, maxWidth: 500, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: GM.onSurface, marginBottom: 12 }}>Assign characters</Text>
        <Text style={{ color: GM.onSurfaceVariant, marginBottom: 12 }}>Select which characters belong to this party.</Text>
        <Divider style={{ marginBottom: 8 }} />
        <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
          {characters.map((char) => {
            const checked = assignCharacterIds.includes(char.id);
            const owner = userById.get(char.user_id)?.name ?? 'Unknown';
            return (
              <Checkbox.Item
                key={char.id}
                label={`${char.name} (${owner})`}
                status={checked ? 'checked' : 'unchecked'}
                onPress={() => toggleAssignCharacter(char.id)}
                position="leading"
              />
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <Button onPress={() => setAssignModalVisible(false)}>Cancel</Button>
          <Button mode="contained" loading={submitting} disabled={submitting} onPress={submitAssignCharacters}>Save</Button>
        </View>
      </Modal>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3000}>{snackbar}</Snackbar>
    </View>
  );
}
