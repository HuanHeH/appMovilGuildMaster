import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Divider,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  apiErrorMessage,
  createEvent,
  getCharacters,
  getParties,
  getSkills,
  getUsers,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useGuildStore } from '@/store/guild-store';
import type { Character, CreateEventRequest, Party, Skill, UserPublic } from '@/types/game';
import {
  characterOwnerLabel,
  isGrantExpSkill,
  isTeacherExpSkill,
} from '@/types/game';

type TargetKind = 'CHARACTER' | 'PARTY' | 'GUILD';

export default function TeacherSkillsScreen() {
  const session = useAuthStore((state) => state.session);
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [targetKind, setTargetKind] = useState<TargetKind>('CHARACTER');
  const [targetCharacterId, setTargetCharacterId] = useState<number | null>(null);
  const [targetPartyId, setTargetPartyId] = useState<number | null>(null);
  const [expAmount, setExpAmount] = useState('10');
  const [characterQuery, setCharacterQuery] = useState('');
  const [partyQuery, setPartyQuery] = useState('');
  const [modalRefreshing, setModalRefreshing] = useState(false);

  const teacherSkills = useMemo(
    () => skills.filter((skill) => isTeacherExpSkill(skill)),
    [skills]
  );
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filteredCharacters = useMemo(() => {
    const q = characterQuery.trim().toLowerCase();
    if (!q) return characters;
    return characters.filter((character) => {
      const owner = userById.get(character.user_id)?.name ?? '';
      const haystack =
        `${character.name} ${owner} ${character.job} ${character.exp}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [characterQuery, characters, userById]);

  const filteredParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((party) => party.name.toLowerCase().includes(q));
  }, [partyQuery, parties]);

  const reloadGuildData = useCallback(async () => {
    if (!session || !selectedGuildId) return;
    const [allSkills, chars, partiesData, usersData] = await Promise.all([
      getSkills(),
      getCharacters(selectedGuildId),
      getParties(selectedGuildId),
      getUsers(selectedGuildId),
    ]);
    setSkills(allSkills);
    setCharacters(chars);
    setParties(partiesData);
    setUsers(usersData);
  }, [session, selectedGuildId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session || !selectedGuildId) return;
        setLoading(true);
        try {
          await reloadGuildData();
          if (!active) return;
        } catch (error) {
          if (active) setSnackbar(apiErrorMessage(error, 'Could not load teacher skills.'));
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => {
        active = false;
      };
    }, [reloadGuildData, selectedGuildId, session])
  );

  const openSkill = async (skill: Skill) => {
    setActiveSkill(skill);
    setTargetKind('CHARACTER');
    setTargetCharacterId(null);
    setTargetPartyId(null);
    setExpAmount('10');
    setCharacterQuery('');
    setPartyQuery('');
    setModalVisible(true);
    setModalRefreshing(true);
    try {
      await reloadGuildData();
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not refresh guild data.'));
    } finally {
      setModalRefreshing(false);
    }
  };

  const submit = async () => {
    if (!selectedGuildId || !activeSkill) return;
    const amount = Number(expAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setSnackbar('Enter a positive EXP amount.');
      return;
    }
    if (targetKind === 'CHARACTER' && !targetCharacterId) {
      setSnackbar('Select a target character.');
      return;
    }
    if (targetKind === 'PARTY' && !targetPartyId) {
      setSnackbar('Select a target party.');
      return;
    }

    const payload: CreateEventRequest = {
      skill_id: activeSkill.id,
      guild_id: selectedGuildId,
      caster_character_id: null,
      target_character_id: targetKind === 'CHARACTER' ? targetCharacterId : null,
      target_party_id: targetKind === 'PARTY' ? targetPartyId : null,
      comment: String(amount),
    };

    try {
      setSubmitting(true);
      await createEvent(payload);
      await reloadGuildData();
      setModalVisible(false);
      setActiveSkill(null);
      const verb = isGrantExpSkill(activeSkill) ? 'Granted' : 'Removed';
      setSnackbar(`${verb} ${amount} EXP (auto-approved).`);
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not apply EXP skill.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedGuildId) return <Redirect href="/(teacher)/profe1" />;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text variant="titleMedium">Skills</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {!teacherSkills.length ? (
          <Text>No Teacher EXP skills found. Run the SQL seed first.</Text>
        ) : (
          teacherSkills.map((skill) => (
            <View
              key={skill.id}
              style={{
                borderWidth: 1,
                borderColor: '#2563eb',
                borderRadius: 10,
                padding: 12,
                backgroundColor: '#eff6ff',
                gap: 6,
              }}>
              <Text variant="titleSmall" style={{ color: '#1d4ed8', fontWeight: '700' }}>
                {skill.name}
              </Text>
              <Text style={{ color: '#1e40af' }}>Target: character / party / guild</Text>
              <Text style={{ color: '#1e3a8a' }}>{skill.description}</Text>
              <Button mode="contained" buttonColor="#2563eb" onPress={() => openSkill(skill)}>
                Use skill
              </Button>
            </View>
          ))
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={{
            margin: 16,
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 16,
            maxHeight: '85%',
          }}>
          <ScrollView>
            <Text variant="titleMedium">{activeSkill?.name}</Text>
            <Divider />

            {modalRefreshing ? (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                <ActivityIndicator />
                <Text style={{ color: '#6b7280' }}>Refreshing guild data…</Text>
              </View>
            ) : (
              <>
            <Text variant="titleSmall" style={{ marginTop: 12 }}>
              EXP amount
            </Text>
            <TextInput
              mode="outlined"
              keyboardType="number-pad"
              value={expAmount}
              onChangeText={setExpAmount}
              style={{ marginTop: 6 }}
            />

            <Text variant="titleSmall" style={{ marginTop: 12 }}>
              Target type
            </Text>
            <RadioButton.Group
              value={targetKind}
              onValueChange={(value) => {
                setTargetKind(value as TargetKind);
                setTargetCharacterId(null);
                setTargetPartyId(null);
                setCharacterQuery('');
                setPartyQuery('');
              }}>
              <RadioButton.Item label="Character" value="CHARACTER" />
              <RadioButton.Item label="Party" value="PARTY" />
              <RadioButton.Item label="Guild" value="GUILD" />
            </RadioButton.Group>

            {targetKind === 'CHARACTER' ? (
              <View style={{ marginTop: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}>
                  <Text variant="titleSmall" style={{ flexShrink: 0 }}>
                    Target character
                  </Text>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Search"
                    value={characterQuery}
                    onChangeText={setCharacterQuery}
                    style={{ flex: 1, height: 40 }}
                  />
                </View>
                <ScrollView
                  style={{ maxHeight: 240, marginTop: 4 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled">
                  <RadioButton.Group
                    value={targetCharacterId ? String(targetCharacterId) : ''}
                    onValueChange={(value) => setTargetCharacterId(Number(value))}>
                    {filteredCharacters.map((character) => (
                      <RadioButton.Item
                        key={character.id}
                        label={`${characterOwnerLabel(character, userById)} · EXP ${character.exp}`}
                        value={String(character.id)}
                      />
                    ))}
                  </RadioButton.Group>
                  {!filteredCharacters.length ? (
                    <Text style={{ marginVertical: 8, color: '#6b7280' }}>No characters match.</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}

            {targetKind === 'PARTY' ? (
              <View style={{ marginTop: 8 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}>
                  <Text variant="titleSmall" style={{ flexShrink: 0 }}>
                    Target party
                  </Text>
                  <TextInput
                    mode="outlined"
                    dense
                    placeholder="Search"
                    value={partyQuery}
                    onChangeText={setPartyQuery}
                    style={{ flex: 1, height: 40 }}
                  />
                </View>
                <ScrollView
                  style={{ maxHeight: 240, marginTop: 4 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled">
                  <RadioButton.Group
                    value={targetPartyId ? String(targetPartyId) : ''}
                    onValueChange={(value) => setTargetPartyId(Number(value))}>
                    {filteredParties.map((party) => (
                      <RadioButton.Item key={party.id} label={party.name} value={String(party.id)} />
                    ))}
                  </RadioButton.Group>
                  {!filteredParties.length ? (
                    <Text style={{ marginVertical: 8, color: '#6b7280' }}>No parties match.</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}

            {targetKind === 'GUILD' ? (
              <Text style={{ marginTop: 8 }}>Applies to every character in the selected guild.</Text>
            ) : null}

            <View
              style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button onPress={() => setModalVisible(false)}>Cancel</Button>
              <Button mode="contained" loading={submitting} onPress={submit}>
                Confirm
              </Button>
            </View>
              </>
            )}
          </ScrollView>
        </Modal>
      </Portal>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3500}>
        {snackbar}
      </Snackbar>
    </View>
  );
}
