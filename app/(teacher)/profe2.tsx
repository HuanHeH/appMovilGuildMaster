import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Platform, ScrollView, TextInput as RNTextInput, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Chip,
  Divider,
  Icon,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
} from '@/components/DesktopListRow';
import {
  apiErrorMessage,
  createEvent,
  getCharacters,
  getParties,
  getSkills,
  getUsers,
} from '@/lib/api';
import {
  centerScreenClass,
  GM,
  modalContentStyle,
  screenClass,
  teacherSkillCardClass,
} from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';
import { useGuildStore } from '@/store/guild-store';
import type { Character, CreateEventRequest, Party, Skill, UserPublic } from '@/types/game';
import {
  characterOwnerLabel,
  isDebuffSkill,
  isGrantExpSkill,
  isTeacherExpSkill,
} from '@/types/game';

/** Match titleSmall row height; Icon outside Paper TextInput (web Affix often invisible). */
const SEARCH_FIELD_HEIGHT = 28;

function CompactSearchField({
  value,
  onChangeText,
  placeholder = 'Search',
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 112,
        height: SEARCH_FIELD_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: GM.outline,
        backgroundColor: GM.white,
      }}>
      <Icon source="magnify" size={16} color={GM.black} />
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#444444"
        style={[
          {
            flex: 1,
            paddingVertical: 0,
            paddingHorizontal: 0,
            margin: 0,
            height: SEARCH_FIELD_HEIGHT - 2,
            color: GM.black,
            fontSize: 13,
            backgroundColor: GM.white,
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
    </View>
  );
}

type TargetKind = 'CHARACTER' | 'PARTY' | 'GUILD';

const TEACHER_SKILL_COLS = [
  { key: 'action', label: 'Launch', flex: 0.95, minWidth: 148 },
  { key: 'name', label: 'Skill', flex: 1.1 },
  { key: 'aoe', label: 'Target', flex: 1.4, minWidth: 200 },
  { key: 'debuff', label: 'Debuff', flex: 0.85, minWidth: 100 },
  { key: 'desc', label: 'Description', flex: 1.8 },
];

function buffDebuffIcon(debuff: boolean) {
  return ({ size }: { size: number }) => (
    <Icon
      source={debuff ? 'skull-crossbones' : 'shield-check'}
      size={size}
      color={debuff ? '#fecaca' : '#22c55e'}
    />
  );
}

export default function TeacherSkillsScreen() {
  const isDesktop = useIsDesktop();
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
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<number[]>([]);
  const [selectedPartyIds, setSelectedPartyIds] = useState<number[]>([]);
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
    setSelectedCharacterIds([]);
    setSelectedPartyIds([]);
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

  const toggleCharacter = (id: number) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleParty = (id: number) => {
    setSelectedPartyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const submit = async () => {
    if (!selectedGuildId || !activeSkill) return;
    const amount = Number(expAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setSnackbar('Enter a positive EXP amount.');
      return;
    }
    if (targetKind === 'CHARACTER' && !selectedCharacterIds.length) {
      setSnackbar('Select at least one target character.');
      return;
    }
    if (targetKind === 'PARTY' && !selectedPartyIds.length) {
      setSnackbar('Select at least one target party.');
      return;
    }

    const base = {
      skill_id: activeSkill.id,
      guild_id: selectedGuildId,
      caster_character_id: null as number | null,
      comment: String(amount),
    };

    const payloads: CreateEventRequest[] =
      targetKind === 'GUILD'
        ? [
            {
              ...base,
              target_character_id: null,
              target_party_id: null,
            },
          ]
        : targetKind === 'CHARACTER'
          ? selectedCharacterIds.map((id) => ({
              ...base,
              target_character_id: id,
              target_party_id: null,
            }))
          : selectedPartyIds.map((id) => ({
              ...base,
              target_character_id: null,
              target_party_id: id,
            }));

    try {
      setSubmitting(true);
      for (const payload of payloads) {
        await createEvent(payload);
      }
      await reloadGuildData();
      setModalVisible(false);
      setActiveSkill(null);
      const verb = isGrantExpSkill(activeSkill) ? 'Granted' : 'Removed';
      const n = payloads.length;
      setSnackbar(
        targetKind === 'GUILD'
          ? `${verb} ${amount} EXP to guild (auto-approved).`
          : `${verb} ${amount} EXP to ${n} target${n === 1 ? '' : 's'} (auto-approved).`
      );
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not apply EXP skill.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedGuildId) return <Redirect href="/(teacher)/profe1" />;

  if (loading) {
    return (
      <View className={centerScreenClass}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className={screenClass}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text variant="titleMedium">Skills</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
        {!teacherSkills.length ? (
          <Text>No Teacher EXP skills found. Run the SQL seed first.</Text>
        ) : isDesktop ? (
          <View style={{ gap: 6 }}>
            <DesktopListHeader columns={TEACHER_SKILL_COLS} />
            {teacherSkills.map((skill) => (
              <View
                key={skill.id}
                className={`${teacherSkillCardClass} gm-skill-card--auto`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                }}>
                <DesktopCell flex={0.95} minWidth={148}>
                  <Button
                    mode="contained"
                    icon="lightning-bolt"
                    buttonColor={GM.primaryContainer}
                    textColor={GM.onPrimary}
                    onPress={() => openSkill(skill)}
                    contentStyle={{ height: 42, paddingHorizontal: 6 }}
                    labelStyle={{ fontWeight: '800', fontSize: 13, letterSpacing: 0.2 }}
                    style={{
                      alignSelf: 'flex-start',
                      minWidth: 132,
                      borderRadius: 8,
                      elevation: 3,
                    }}>
                    Launch
                  </Button>
                </DesktopCell>
                <DesktopCell flex={1.2}>
                  <DesktopCellText
                    primary={skill.name}
                    secondary="Teacher · Auto"
                    primaryStyle={{ color: GM.primary }}
                  />
                </DesktopCell>
                <DesktopCell flex={1.4} minWidth={200}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    <Chip compact icon="account">
                      SINGLE
                    </Chip>
                    <Chip compact icon="account-group">
                      PARTY
                    </Chip>
                    <Chip compact icon="domain">
                      GUILD
                    </Chip>
                  </View>
                </DesktopCell>
                <DesktopCell flex={0.85} minWidth={100}>
                  <Chip
                    compact
                    icon={buffDebuffIcon(isDebuffSkill(skill))}
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: isDebuffSkill(skill) ? '#7f1d1d' : '#14532d',
                      borderWidth: 1,
                      borderColor: isDebuffSkill(skill) ? '#ef4444' : '#22c55e',
                    }}
                    textStyle={{
                      color: isDebuffSkill(skill) ? '#fecaca' : '#bbf7d0',
                      fontWeight: '700',
                    }}>
                    {isDebuffSkill(skill) ? 'Debuff' : 'Buff'}
                  </Chip>
                </DesktopCell>
                <DesktopCell flex={2}>
                  <DesktopCellText
                    primary={skill.description}
                    primaryStyle={{
                      color: GM.onSurfaceVariant,
                      fontWeight: '500',
                      fontSize: 13,
                    }}
                    numberOfLines={3}
                  />
                </DesktopCell>
              </View>
            ))}
          </View>
        ) : (
          teacherSkills.map((skill) => (
            <View key={skill.id} className={`${teacherSkillCardClass} gm-skill-card--auto`}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                  <Text
                    variant="titleMedium"
                    numberOfLines={2}
                    style={{ color: GM.primary, fontWeight: '800', fontSize: 17 }}>
                    {skill.name}
                  </Text>
                  <Text style={{ color: GM.onSurfaceMuted, fontSize: 12, fontWeight: '600' }}>
                    Teacher · Auto
                  </Text>
                </View>
                <Button
                  compact
                  mode="contained"
                  icon="lightning-bolt"
                  buttonColor={GM.primaryContainer}
                  textColor={GM.onPrimary}
                  onPress={() => openSkill(skill)}
                  contentStyle={{ height: 36, paddingHorizontal: 6 }}
                  labelStyle={{ fontWeight: '800', fontSize: 12, letterSpacing: 0.2 }}
                  style={{
                    borderRadius: 8,
                    elevation: 3,
                  }}>
                  Launch
                </Button>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                <Chip compact icon="account">
                  SINGLE
                </Chip>
                <Chip compact icon="account-group">
                  PARTY
                </Chip>
                <Chip compact icon="domain">
                  GUILD
                </Chip>
                <Chip
                  compact
                  icon={buffDebuffIcon(isDebuffSkill(skill))}
                  style={{
                    backgroundColor: isDebuffSkill(skill) ? '#7f1d1d' : '#14532d',
                    borderWidth: 1,
                    borderColor: isDebuffSkill(skill) ? '#ef4444' : '#22c55e',
                  }}
                  textStyle={{
                    color: isDebuffSkill(skill) ? '#fecaca' : '#bbf7d0',
                    fontWeight: '700',
                  }}>
                  {isDebuffSkill(skill) ? 'Debuff' : 'Buff'}
                </Chip>
              </View>
              <Text style={{ color: GM.onSurfaceMuted }}>Target: character / party / guild</Text>
              <Text style={{ color: GM.onSurfaceVariant }}>{skill.description}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={modalContentStyle}>
          <ScrollView>
            <Text variant="titleMedium">{activeSkill?.name}</Text>
            <Divider />

            {modalRefreshing ? (
              <View style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
                <ActivityIndicator />
                <Text style={{ color: GM.tertiary }}>Refreshing guild data…</Text>
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
                setSelectedCharacterIds([]);
                setSelectedPartyIds([]);
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
                    gap: 8,
                  }}>
                  <Text variant="titleSmall" style={{ flexShrink: 0, lineHeight: SEARCH_FIELD_HEIGHT }}>
                    Target characters
                    {selectedCharacterIds.length
                      ? ` (${selectedCharacterIds.length})`
                      : ''}
                  </Text>
                  <CompactSearchField
                    value={characterQuery}
                    onChangeText={setCharacterQuery}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                  }}>
                  <Button
                    compact
                    mode="outlined"
                    onPress={() =>
                      setSelectedCharacterIds(filteredCharacters.map((c) => c.id))
                    }
                    disabled={!filteredCharacters.length}>
                    Select all
                  </Button>
                  <Button
                    compact
                    mode="text"
                    onPress={() => setSelectedCharacterIds([])}
                    disabled={!selectedCharacterIds.length}>
                    Clear
                  </Button>
                </View>
                <ScrollView
                  style={{ maxHeight: 240, marginTop: 4 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled">
                  {filteredCharacters.map((character) => {
                    const checked = selectedCharacterIds.includes(character.id);
                    return (
                      <Checkbox.Item
                        key={character.id}
                        label={`${characterOwnerLabel(character, userById)} · EXP ${character.exp}`}
                        status={checked ? 'checked' : 'unchecked'}
                        onPress={() => toggleCharacter(character.id)}
                        position="leading"
                      />
                    );
                  })}
                  {!filteredCharacters.length ? (
                    <Text style={{ marginVertical: 8, color: GM.tertiary }}>No characters match.</Text>
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
                    gap: 8,
                  }}>
                  <Text variant="titleSmall" style={{ flexShrink: 0, lineHeight: SEARCH_FIELD_HEIGHT }}>
                    Target parties
                    {selectedPartyIds.length ? ` (${selectedPartyIds.length})` : ''}
                  </Text>
                  <CompactSearchField value={partyQuery} onChangeText={setPartyQuery} />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginTop: 8,
                  }}>
                  <Button
                    compact
                    mode="outlined"
                    onPress={() => setSelectedPartyIds(filteredParties.map((p) => p.id))}
                    disabled={!filteredParties.length}>
                    Select all
                  </Button>
                  <Button
                    compact
                    mode="text"
                    onPress={() => setSelectedPartyIds([])}
                    disabled={!selectedPartyIds.length}>
                    Clear
                  </Button>
                </View>
                <ScrollView
                  style={{ maxHeight: 240, marginTop: 4 }}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled">
                  {filteredParties.map((party) => {
                    const checked = selectedPartyIds.includes(party.id);
                    return (
                      <Checkbox.Item
                        key={party.id}
                        label={party.name}
                        status={checked ? 'checked' : 'unchecked'}
                        onPress={() => toggleParty(party.id)}
                        position="leading"
                      />
                    );
                  })}
                  {!filteredParties.length ? (
                    <Text style={{ marginVertical: 8, color: GM.tertiary }}>No parties match.</Text>
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
