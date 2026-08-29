import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  List,
  Menu,
  Modal,
  Portal,
  RadioButton,
  Snackbar,
  Text,
} from 'react-native-paper';

import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
} from '@/components/DesktopListRow';
import { CompactSearchField, COMPACT_SEARCH_FIELD_HEIGHT } from '@/components/CompactSearchField';
import {
  apiErrorMessage,
  createEvent,
  getCharacters,
  getParties,
  getSkills,
  setCharacterJob,
} from '@/lib/api';
import { showConfirm } from '@/lib/alert';
import {
  accordionStyle,
  centerScreenClass,
  GM,
  modalContentStyle,
  screenClass,
  screenPadClass,
  skillCardClass,
  skillCardTextColors,
} from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';
import type { Character, CharacterJob, CreateEventRequest, Party, Skill } from '@/types/game';
import {
  isAutoEventSkill,
  isChangeJobSkill,
  isCommonSkill,
  isDebuffSkill,
  isProgressionSkill,
  shouldShowSkillForCharacter,
  skillListSection,
} from '@/types/game';

const JOBS: CharacterJob[] = ['Mage', 'Rogue', 'Paladin'];
const LEVEL_SECTIONS = [1, 2, 3, 4] as const;

const SKILL_COLS = [
  { key: 'action', label: 'Launch', flex: 0.95, minWidth: 148 },
  { key: 'name', label: 'Skill', flex: 1.2 },
  { key: 'exp', label: 'EXP', flex: 0.5, minWidth: 64 },
  { key: 'aoe', label: 'AOE', flex: 0.85, minWidth: 100 },
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

const FALLBACK_CHANGE_JOB: Skill = {
  id: -1,
  name: 'Change Job',
  level_req: 3,
  job: 'Common',
  description: 'Change class at level 3. Choose a different job. Applies automatically.',
  aoe: 'SINGLE',
  exp_cost: 40,
  debuff: false,
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
  const isDesktop = useIsDesktop();
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
  const [characterQuery, setCharacterQuery] = useState('');
  const [partyQuery, setPartyQuery] = useState('');
  const [changeJobTarget, setChangeJobTarget] = useState<CharacterJob | null>(null);
  const [jobMenuVisible, setJobMenuVisible] = useState(false);
  const [choosingJob, setChoosingJob] = useState<CharacterJob | null>(null);
  const [jobSelectSubmitting, setJobSelectSubmitting] = useState(false);
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

  const filteredGuildCharacters = useMemo(() => {
    const q = characterQuery.trim().toLowerCase();
    if (!q) return guildCharacters;
    return guildCharacters.filter((character) => {
      const haystack = `${character.name} ${character.job} ${character.level}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [characterQuery, guildCharacters]);

  const filteredGuildParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return guildParties;
    return guildParties.filter((party) => party.name.toLowerCase().includes(q));
  }, [partyQuery, guildParties]);

  const otherJobs = useMemo(() => {
    if (!selectedCharacter || !selectedCharacter.job) return JOBS;
    return JOBS.filter((job) => job !== selectedCharacter.job);
  }, [selectedCharacter]);

  const chooseJob = async (job: CharacterJob) => {
    if (!selectedCharacter) return;
    try {
      setJobSelectSubmitting(true);
      await setCharacterJob(selectedCharacter.id, job);
      await refreshCharacters();
      setSnackbar(`You are now a ${job}!`);
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not set your class.'));
    } finally {
      setJobSelectSubmitting(false);
    }
  };

  const openUseSkillFlow = (skill: Skill) => {
    if (!selectedCharacter) return;

    // Never open confirm/target modals without enough EXP.
    setSkillModalVisible(false);
    setJobMenuVisible(false);
    setActiveSkill(null);

    if (selectedCharacter.exp < skill.exp_cost) {
      showConfirm(
        'Not enough EXP',
        `You need ${skill.exp_cost} EXP and your character has ${selectedCharacter.exp}.`,
        () => {}
      );
      return;
    }
    if (selectedCharacter.level < skill.level_req) {
      showConfirm('Skill locked', 'Blocked: insufficient level.', () => {});
      return;
    }

    const message = isDebuffSkill(skill)
      ? `Use ${skill.name} for ${skill.exp_cost} EXP? If approved, targets each gain ${Math.floor(skill.exp_cost / 2)} EXP (debuff).`
      : `Use ${skill.name} for ${skill.exp_cost} EXP?`;

    showConfirm('Confirm skill use', message, () => {
      // Re-check EXP in case state changed before confirm.
      if (selectedCharacter.exp < skill.exp_cost) {
        showConfirm(
          'Not enough EXP',
          `You need ${skill.exp_cost} EXP and your character has ${selectedCharacter.exp}.`,
          () => {}
        );
        return;
      }
      setActiveSkill(skill);
      setTargetPartyId(null);
      setChangeJobTarget(null);
      setCharacterQuery('');
      setPartyQuery('');
      setJobMenuVisible(false);
      if (isProgressionSkill(skill)) {
        setTargetCharacterId(selectedCharacter.id);
      } else {
        setTargetCharacterId(null);
      }
      setSkillModalVisible(true);
    });
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
      if (created.status === 'AUTO') {
        if (isChangeJobSkill(activeSkill)) {
          setSnackbar(`Change Job applied to ${changeJobTarget}. EXP spent.`);
        } else {
          setSnackbar('Level up applied. EXP spent.');
        }
      } else if (created.status === 'APPROVED') {
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
      <View className={centerScreenClass}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!selectedCharacter) {
    return (
      <View className={screenPadClass}>
        <Text>Select a character in Profile first.</Text>
      </View>
    );
  }

  if (!selectedCharacter.job) {
    const JOB_INFO: Record<CharacterJob, { icon: string; color: string; desc: string; skills: string[] }> = {
      Mage: {
        icon: 'fire',
        color: '#3b82f6',
        desc: 'Spellcaster who deals magical damage to enemies.',
        skills: ['Fireball — Deal damage to a single target', 'More skills unlock as you level up'],
      },
      Rogue: {
        icon: 'knife',
        color: '#22c55e',
        desc: 'Stealthy attacker who excels at quick strikes.',
        skills: ['Stealth-based abilities', 'More skills unlock as you level up'],
      },
      Paladin: {
        icon: 'shield',
        color: '#eab308',
        desc: 'Holy warrior who combines defense and healing.',
        skills: ['Defensive abilities', 'More skills unlock as you level up'],
      },
    };
    return (
      <View className={screenClass}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} style={{ flex: 1 }}>
          <Text variant="titleMedium" style={{ color: GM.primary, fontWeight: '700' }}>Choose your class</Text>
          <Text style={{ color: GM.onSurfaceVariant }}>
            Your character <Text style={{ fontWeight: '700' }}>{selectedCharacter.name}</Text> doesn't have a class yet.
            Pick one below to start using skills.
          </Text>
          {JOBS.map((job) => {
            const info = JOB_INFO[job];
            return (
              <Card key={job} mode="outlined" style={{ borderColor: info.color, borderWidth: 1 }}>
                <Card.Content style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Icon source={info.icon} size={28} color={info.color} />
                    <Text variant="titleMedium" style={{ fontWeight: '700', color: info.color }}>{job}</Text>
                  </View>
                  <Text style={{ color: GM.onSurface }}>{info.desc}</Text>
                  <Text style={{ color: GM.tertiary, fontSize: 13, fontWeight: '600' }}>Abilities:</Text>
                  {info.skills.map((skill, i) => (
                    <Text key={i} style={{ color: GM.onSurfaceVariant, fontSize: 13 }}>• {skill}</Text>
                  ))}
                  <Button
                    mode="contained"
                    buttonColor={info.color}
                    style={{ marginTop: 8, alignSelf: 'flex-start' }}
                    loading={jobSelectSubmitting}
                    disabled={jobSelectSubmitting}
                    onPress={() => chooseJob(job)}>
                    Choose {job}
                  </Button>
                </Card.Content>
              </Card>
            );
          })}
        </ScrollView>
        <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3500}>
          {snackbar}
        </Snackbar>
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
              style={accordionStyle}>
              <View style={{ gap: 8, paddingBottom: 8, paddingHorizontal: 4 }}>
                {isDesktop ? <DesktopListHeader columns={SKILL_COLS} /> : null}
                {sectionSkills.map((skill) => {
                  const locked = selectedCharacter.level < skill.level_req;
                  const common = isCommonSkill(skill);
                  const auto = isAutoEventSkill(skill);
                  const colors = skillCardTextColors(common, locked);
                  const desc =
                    skill.description + (locked ? ' (blocked: insufficient level)' : '');

                  if (isDesktop) {
                    return (
                      <View
                        key={skill.id}
                        className={skillCardClass(common, locked, auto)}
                        style={{
                          opacity: locked && !common ? 0.7 : 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                        }}>
                        <DesktopCell flex={0.95} minWidth={148}>
                          <Button
                            mode={locked ? 'outlined' : 'contained'}
                            icon={locked ? 'lock' : 'lightning-bolt'}
                            buttonColor={locked ? undefined : GM.primaryContainer}
                            textColor={locked ? GM.tertiary : GM.onPrimary}
                            onPress={() => openUseSkillFlow(skill)}
                            contentStyle={{ height: 42, paddingHorizontal: 6 }}
                            labelStyle={{ fontWeight: '800', fontSize: 13, letterSpacing: 0.2 }}
                            style={{
                              alignSelf: 'flex-start',
                              minWidth: 132,
                              borderRadius: 8,
                              elevation: locked ? 0 : 3,
                            }}>
                            {locked ? 'Locked' : 'Launch'}
                          </Button>
                        </DesktopCell>
                        <DesktopCell flex={1.2}>
                          <DesktopCellText
                            primary={skill.name}
                            secondary={
                              common
                                ? auto
                                  ? 'Common · Auto'
                                  : 'Common'
                                : skill.job
                            }
                            primaryStyle={{ color: colors.title }}
                            secondaryStyle={{ color: colors.desc }}
                          />
                        </DesktopCell>
                        <DesktopCell flex={0.5} minWidth={64}>
                          <DesktopCellText
                            primary={`${skill.exp_cost}`}
                            primaryStyle={locked ? { color: GM.tertiary } : undefined}
                          />
                        </DesktopCell>
                        <DesktopCell flex={0.85} minWidth={100}>
                          <Chip
                            compact
                            icon="target"
                            style={
                              locked
                                ? { opacity: 0.75, alignSelf: 'flex-start' }
                                : { alignSelf: 'flex-start' }
                            }
                            textStyle={locked ? { color: GM.tertiary } : undefined}>
                            {skill.aoe}
                          </Chip>
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
                              opacity: locked ? 0.75 : 1,
                            }}
                            textStyle={{
                              color: isDebuffSkill(skill) ? '#fecaca' : '#bbf7d0',
                              fontWeight: '700',
                            }}>
                            {isDebuffSkill(skill) ? 'Debuff' : 'Buff'}
                          </Chip>
                        </DesktopCell>
                        <DesktopCell flex={1.8}>
                          <DesktopCellText
                            primary={desc}
                            primaryStyle={{
                              color: colors.desc,
                              fontWeight: '500',
                              fontSize: 13,
                            }}
                            numberOfLines={3}
                          />
                        </DesktopCell>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={skill.id}
                      className={skillCardClass(common, locked, auto)}
                      style={{ opacity: locked && !common ? 0.7 : 1, gap: 6 }}>
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
                            style={{
                              color: colors.title,
                              fontWeight: '800',
                              fontSize: 17,
                            }}>
                            {skill.name}
                          </Text>
                          <Text style={{ color: colors.desc, fontSize: 12, fontWeight: '600' }}>
                            {common ? (auto ? 'Common · Auto' : 'Common') : skill.job}
                          </Text>
                        </View>
                        <Button
                          compact
                          mode={locked ? 'outlined' : 'contained'}
                          icon={locked ? 'lock' : 'lightning-bolt'}
                          buttonColor={locked ? undefined : GM.primaryContainer}
                          textColor={locked ? GM.tertiary : GM.onPrimary}
                          onPress={() => openUseSkillFlow(skill)}
                          contentStyle={{ height: 36, paddingHorizontal: 6 }}
                          labelStyle={{ fontWeight: '800', fontSize: 12, letterSpacing: 0.2 }}
                          style={{
                            borderRadius: 8,
                            borderColor: locked ? GM.outline : undefined,
                            elevation: locked ? 0 : 3,
                          }}>
                          {locked ? 'Locked' : 'Launch'}
                        </Button>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        <Chip
                          compact
                          icon="lightning-bolt"
                          style={locked ? { opacity: 0.75 } : undefined}
                          textStyle={locked ? { color: GM.tertiary } : undefined}>
                          {skill.exp_cost} EXP
                        </Chip>
                        <Chip
                          compact
                          icon="target"
                          style={locked ? { opacity: 0.75 } : undefined}
                          textStyle={locked ? { color: GM.tertiary } : undefined}>
                          {skill.aoe}
                        </Chip>
                        <Chip
                          compact
                          icon={buffDebuffIcon(isDebuffSkill(skill))}
                          style={{
                            backgroundColor: isDebuffSkill(skill) ? '#7f1d1d' : '#14532d',
                            borderWidth: 1,
                            borderColor: isDebuffSkill(skill) ? '#ef4444' : '#22c55e',
                            opacity: locked ? 0.75 : 1,
                          }}
                          textStyle={{
                            color: isDebuffSkill(skill) ? '#fecaca' : '#bbf7d0',
                            fontWeight: '700',
                          }}>
                          {isDebuffSkill(skill) ? 'Debuff' : 'Buff'}
                        </Chip>
                      </View>
                      <Text style={{ color: colors.desc }}>{desc}</Text>
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
          contentContainerStyle={{ ...modalContentStyle, maxHeight: '80%' }}>
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
            <View style={{ marginTop: 12, gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                <Text
                  variant="titleSmall"
                  style={{ flexShrink: 0, lineHeight: COMPACT_SEARCH_FIELD_HEIGHT }}>
                  Target character
                </Text>
                <CompactSearchField
                  value={characterQuery}
                  onChangeText={setCharacterQuery}
                  placeholder="Search"
                />
              </View>
              <ScrollView
                style={{ maxHeight: 240 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                <RadioButton.Group
                  value={targetCharacterId ? String(targetCharacterId) : ''}
                  onValueChange={(value) => setTargetCharacterId(Number(value))}>
                  {filteredGuildCharacters.map((character) => (
                    <RadioButton.Item
                      key={character.id}
                      label={`${character.name} (${character.job})`}
                      value={String(character.id)}
                    />
                  ))}
                </RadioButton.Group>
                {!filteredGuildCharacters.length ? (
                  <Text style={{ marginVertical: 8, color: GM.tertiary }}>No characters match.</Text>
                ) : null}
              </ScrollView>
            </View>
          ) : null}

          {activeSkill?.aoe === 'PARTY' ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}>
                <Text
                  variant="titleSmall"
                  style={{ flexShrink: 0, lineHeight: COMPACT_SEARCH_FIELD_HEIGHT }}>
                  Target party
                </Text>
                <CompactSearchField
                  value={partyQuery}
                  onChangeText={setPartyQuery}
                  placeholder="Search"
                />
              </View>
              <ScrollView
                style={{ maxHeight: 240 }}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled">
                <RadioButton.Group
                  value={targetPartyId ? String(targetPartyId) : ''}
                  onValueChange={(value) => setTargetPartyId(Number(value))}>
                  {filteredGuildParties.map((party) => (
                    <RadioButton.Item key={party.id} label={party.name} value={String(party.id)} />
                  ))}
                </RadioButton.Group>
                {!filteredGuildParties.length ? (
                  <Text style={{ marginVertical: 8, color: GM.tertiary }}>No parties match.</Text>
                ) : null}
              </ScrollView>
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
