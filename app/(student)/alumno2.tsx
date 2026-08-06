import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  List,
  Menu,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
} from 'react-native-paper';

import {
  apiErrorMessage,
  createEvent,
  getCharacters,
  getParties,
  getSkills,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';
import type { Character, CharacterJob, CreateEventRequest, Party, Skill } from '@/types/game';
import {
  isChangeJobSkill,
  isCommonSkill,
  isProgressionSkill,
  shouldShowSkillForCharacter,
  skillListSection,
} from '@/types/game';

const JOBS: CharacterJob[] = ['Mage', 'Rogue', 'Paladin'];
const LEVEL_SECTIONS = [1, 2, 3, 4] as const;

const FALLBACK_CHANGE_JOB: Skill = {
  id: -1,
  name: 'Change Job',
  level_req: 3,
  job: 'Common',
  description: 'Change class at level 3+. Choose Mage, Rogue or Paladin (different from current).',
  aoe: 'SINGLE',
  exp_cost: 80,
};

type SkillsByLevel = Record<(typeof LEVEL_SECTIONS)[number], Skill[]>;

function emptySkillsByLevel(): SkillsByLevel {
  return { 1: [], 2: [], 3: [], 4: [] };
}

function withChangeJobFallback(apiSkills: Skill[]): Skill[] {
  if (apiSkills.some((skill) => isChangeJobSkill(skill))) return apiSkills;
  return [...apiSkills, FALLBACK_CHANGE_JOB];
}

function groupSkillsByLevel(allSkills: Skill[], character: Character): SkillsByLevel {
  const grouped = emptySkillsByLevel();
  const catalog = withChangeJobFallback(allSkills);

  for (const skill of catalog) {
    if (skill.job !== character.job && !isCommonSkill(skill)) continue;
    if (!shouldShowSkillForCharacter(skill, character.level)) continue;
    const section = skillListSection(skill);
    if (section === 1 || section === 2 || section === 3 || section === 4) {
      grouped[section].push(skill);
    }
  }
  for (const level of LEVEL_SECTIONS) {
    grouped[level].sort((a, b) => {
      const aCommon = isCommonSkill(a) ? 1 : 0;
      const bCommon = isCommonSkill(b) ? 1 : 0;
      if (aCommon !== bCommon) return aCommon - bCommon;
      return a.name.localeCompare(b.name);
    });
  }
  return grouped;
}

export default function SkillsScreen() {
  const session = useAuthStore((state) => state.session);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const refreshCharacters = useCharacterStore((state) => state.refreshCharacters);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);

  const [guildCharacters, setGuildCharacters] = useState<Character[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [skillModalVisible, setSkillModalVisible] = useState(false);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [targetCharacterId, setTargetCharacterId] = useState<number | null>(null);
  const [targetPartyId, setTargetPartyId] = useState<number | null>(null);
  const [changeJobTarget, setChangeJobTarget] = useState<CharacterJob | null>(null);
  const [jobMenuVisible, setJobMenuVisible] = useState(false);
  const [expandedLevels, setExpandedLevels] = useState<Record<(typeof LEVEL_SECTIONS)[number], boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
  });

  const skillsByLevel = useMemo(() => {
    if (!selectedCharacter) return emptySkillsByLevel();
    return groupSkillsByLevel(skills, selectedCharacter);
  }, [selectedCharacter, skills]);

  useEffect(() => {
    if (!selectedCharacter) return;
    const level = Math.min(4, Math.max(1, selectedCharacter.level)) as (typeof LEVEL_SECTIONS)[number];
    setExpandedLevels({
      1: level === 1,
      2: level === 2,
      3: level === 3,
      4: level === 4,
    });
  }, [selectedCharacter?.id, selectedCharacter?.level]);

  const toggleLevel = (level: (typeof LEVEL_SECTIONS)[number]) => {
    setExpandedLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session) return;
        setLoading(true);
        try {
          const [, allSkills] = await Promise.all([refreshCharacters(), getSkills()]);
          if (!active) return;
          setSkills(allSkills);
        } catch (error) {
          if (active) setSnackbar(apiErrorMessage(error, 'Could not load skills.'));
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

  useEffect(() => {
    async function loadGuildScope() {
      if (!selectedCharacter) {
        setGuildCharacters([]);
        setParties([]);
        return;
      }
      try {
        const [chars, partiesData] = await Promise.all([
          getCharacters(selectedCharacter.guild_id),
          getParties(selectedCharacter.guild_id),
        ]);
        setGuildCharacters(chars);
        setParties(partiesData);
      } catch (error) {
        setSnackbar(apiErrorMessage(error, 'Could not load guild targets.'));
      }
    }
    loadGuildScope();
  }, [selectedCharacter]);

  const guildParties = useMemo(() => {
    if (!selectedCharacter) return [];
    return parties.filter((p) => p.guild_id === selectedCharacter.guild_id);
  }, [parties, selectedCharacter]);

  const otherJobs = useMemo(() => {
    if (!selectedCharacter) return JOBS;
    return JOBS.filter((job) => job !== selectedCharacter.job);
  }, [selectedCharacter]);

  const openUseSkillFlow = (skill: Skill) => {
    if (!selectedCharacter) return;

    // Never open confirm/target modals without enough EXP.
    setSkillModalVisible(false);
    setJobMenuVisible(false);
    setActiveSkill(null);

    if (selectedCharacter.exp < skill.exp_cost) {
      Alert.alert(
        'Not enough EXP',
        `You need ${skill.exp_cost} EXP and your character has ${selectedCharacter.exp}.`
      );
      return;
    }
    if (selectedCharacter.level < skill.level_req) {
      Alert.alert('Skill locked', 'Blocked: insufficient level.');
      return;
    }

    Alert.alert('Confirm skill use', `Use ${skill.name} for ${skill.exp_cost} EXP?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Use skill',
        onPress: () => {
          // Re-check EXP in case state changed before confirm.
          if (selectedCharacter.exp < skill.exp_cost) {
            Alert.alert(
              'Not enough EXP',
              `You need ${skill.exp_cost} EXP and your character has ${selectedCharacter.exp}.`
            );
            return;
          }
          setActiveSkill(skill);
          setTargetPartyId(null);
          setChangeJobTarget(null);
          setJobMenuVisible(false);
          if (isProgressionSkill(skill)) {
            setTargetCharacterId(selectedCharacter.id);
          } else {
            setTargetCharacterId(null);
          }
          setSkillModalVisible(true);
        },
      },
    ]);
  };

  const submitEvent = async () => {
    if (!selectedCharacter || !activeSkill) return;

    if (isChangeJobSkill(activeSkill) && !changeJobTarget) {
      setSnackbar('Select the new class from the dropdown.');
      return;
    }
    if (activeSkill.aoe === 'SINGLE' && !targetCharacterId) {
      setSnackbar('Select a target character.');
      return;
    }
    if (activeSkill.aoe === 'PARTY' && !targetPartyId) {
      setSnackbar('Select a target party.');
      return;
    }

    const payload: CreateEventRequest = {
      caster_character_id: selectedCharacter.id,
      skill_id: activeSkill.id,
      guild_id: selectedCharacter.guild_id,
      target_character_id: activeSkill.aoe === 'SINGLE' ? targetCharacterId : null,
      target_party_id: activeSkill.aoe === 'PARTY' ? targetPartyId : null,
      comment: isChangeJobSkill(activeSkill) ? changeJobTarget : null,
    };

    try {
      setSubmitting(true);
      const created = await createEvent(payload);
      await refreshCharacters();
      setSkillModalVisible(false);
      setActiveSkill(null);
      setJobMenuVisible(false);
      if (created.status === 'APPROVED') {
        if (isChangeJobSkill(activeSkill)) {
          setSnackbar(`Change Job applied to ${changeJobTarget}. EXP spent.`);
        } else {
          setSnackbar('Level up applied. EXP spent.');
        }
      } else {
        setSnackbar('Skill launched (PENDING). EXP spent.');
      }
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not create event.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedCharacterId) return <Redirect href="/(student)/alumno1" />;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (!selectedCharacter) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text>Select a character in Profile first.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text variant="titleMedium">Skills</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        {LEVEL_SECTIONS.map((level) => {
          const sectionSkills = skillsByLevel[level] ?? [];
          if (!sectionSkills.length) return null;
          const expanded = expandedLevels[level];
          return (
            <List.Accordion
              key={`lvl-${level}`}
              title={`Lvl ${level}`}
              description={`${sectionSkills.length} skill${sectionSkills.length === 1 ? '' : 's'}`}
              expanded={expanded}
              onPress={() => toggleLevel(level)}
              style={{
                backgroundColor: '#f9fafb',
                borderWidth: 1,
                borderColor: '#e5e7eb',
                borderRadius: 10,
              }}>
              <View style={{ gap: 8, paddingBottom: 8, paddingHorizontal: 4 }}>
                {sectionSkills.map((skill) => {
                  const locked = selectedCharacter.level < skill.level_req;
                  const common = isCommonSkill(skill);
                  return (
                    <View
                      key={skill.id}
                      style={{
                        borderWidth: 1,
                        borderColor: common ? '#2563eb' : locked ? '#d1d5db' : '#e5e7eb',
                        borderRadius: 10,
                        padding: 10,
                        backgroundColor: common
                          ? locked
                            ? '#dbeafe'
                            : '#eff6ff'
                          : locked
                            ? '#f3f4f6'
                            : '#ffffff',
                        opacity: locked && !common ? 0.7 : 1,
                        gap: 4,
                      }}>
                      <Text
                        variant="titleSmall"
                        style={
                          common
                            ? { color: '#1d4ed8', fontWeight: '700' }
                            : locked
                              ? { color: '#6b7280' }
                              : undefined
                        }>
                        {skill.name}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <Chip
                          compact
                          icon="lightning-bolt"
                          style={locked ? { opacity: 0.75 } : undefined}
                          textStyle={locked ? { color: '#6b7280' } : undefined}>
                          {skill.exp_cost} EXP
                        </Chip>
                        <Chip
                          compact
                          icon="target"
                          style={locked ? { opacity: 0.75 } : undefined}
                          textStyle={locked ? { color: '#6b7280' } : undefined}>
                          {skill.aoe}
                        </Chip>
                      </View>
                      <Text
                        style={
                          common
                            ? { color: '#1e3a8a' }
                            : locked
                              ? { color: '#6b7280' }
                              : undefined
                        }>
                        {skill.description}
                        {locked ? ' (blocked: insufficient level)' : ''}
                      </Text>
                      <Button
                        mode={locked ? 'outlined' : 'contained'}
                        buttonColor={common && !locked ? '#2563eb' : undefined}
                        onPress={() => openUseSkillFlow(skill)}>
                        {locked ? 'Locked' : 'Use skill'}
                      </Button>
                    </View>
                  );
                })}
              </View>
            </List.Accordion>
          );
        })}
      </ScrollView>

      <Portal>
        <Modal
          visible={skillModalVisible}
          onDismiss={() => {
            setSkillModalVisible(false);
            setJobMenuVisible(false);
          }}
          contentContainerStyle={{
            margin: 16,
            backgroundColor: 'white',
            borderRadius: 12,
            padding: 16,
            maxHeight: '80%',
          }}>
          <Text variant="titleMedium">Launch: {activeSkill?.name}</Text>
          <Divider />

          {activeSkill && isProgressionSkill(activeSkill) && !isChangeJobSkill(activeSkill) ? (
            <Text style={{ marginTop: 12 }}>
              Progression skill targets yourself ({selectedCharacter.name}).
            </Text>
          ) : null}

          {activeSkill && isChangeJobSkill(activeSkill) ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text variant="titleSmall">New class (dropdown)</Text>
              <Text>
                Current: {selectedCharacter.job}. Choose Mage, Rogue or Paladin (different class).
              </Text>
              <Menu
                visible={jobMenuVisible}
                onDismiss={() => setJobMenuVisible(false)}
                anchor={
                  <Button mode="outlined" onPress={() => setJobMenuVisible(true)}>
                    {changeJobTarget ?? 'Select new class'}
                  </Button>
                }>
                {otherJobs.map((job) => (
                  <Menu.Item
                    key={job}
                    onPress={() => {
                      setChangeJobTarget(job);
                      setJobMenuVisible(false);
                    }}
                    title={job}
                  />
                ))}
              </Menu>
            </View>
          ) : null}

          {activeSkill?.aoe === 'SINGLE' && activeSkill && !isProgressionSkill(activeSkill) ? (
            <View style={{ marginTop: 12, gap: 4 }}>
              <Text variant="titleSmall">Target character</Text>
              <RadioButton.Group
                value={targetCharacterId ? String(targetCharacterId) : ''}
                onValueChange={(value) => setTargetCharacterId(Number(value))}>
                {guildCharacters.map((character) => (
                  <RadioButton.Item
                    key={character.id}
                    label={`${character.name} (${character.job})`}
                    value={String(character.id)}
                  />
                ))}
              </RadioButton.Group>
            </View>
          ) : null}

          {activeSkill?.aoe === 'PARTY' ? (
            <View style={{ marginTop: 12, gap: 4 }}>
              <Text variant="titleSmall">Target party</Text>
              <RadioButton.Group
                value={targetPartyId ? String(targetPartyId) : ''}
                onValueChange={(value) => setTargetPartyId(Number(value))}>
                {guildParties.map((party) => (
                  <RadioButton.Item key={party.id} label={party.name} value={String(party.id)} />
                ))}
              </RadioButton.Group>
            </View>
          ) : null}

          {activeSkill?.aoe === 'GUILD' ? (
            <Text style={{ marginTop: 12 }}>Guild skill: no target selection needed.</Text>
          ) : null}

          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <Button
              onPress={() => {
                setSkillModalVisible(false);
                setJobMenuVisible(false);
              }}>
              Cancel
            </Button>
            <Button mode="contained" loading={submitting} onPress={submitEvent}>
              Confirm launch
            </Button>
          </View>
        </Modal>
      </Portal>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3500}>
        {snackbar}
      </Snackbar>
    </View>
  );
}
