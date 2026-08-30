import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, Chip, Icon, Snackbar, Text } from 'react-native-paper';

import { EventCommentChip } from '@/components/EventCommentChip';
import { CompactSearchField } from '@/components/CompactSearchField';
import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
} from '@/components/DesktopListRow';
import { getCharacters, getEvents, getGuilds, getParties, getSkills, getUsers, deleteEvent, apiErrorMessage } from '@/lib/api';
import { showConfirm } from '@/lib/alert';
import { eventMatchesSearch, isStudentEventVisibleForCharacter } from '@/lib/event-search';
import {
  centerScreenClass,
  eventReviewChipColors,
  eventStatusBadgeClass,
  eventStatusCardClass,
  filtersCardClass,
  GM,
  highlightNameStyle,
  mutedLabelClass,
  screenClass,
  screenPadClass,
} from '@/lib/guildmaster-theme';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';
import type { Character, EventStatus, GameEvent, Guild, Party, Skill, UserPublic } from '@/types/game';
import {
  characterOwnerLabel,
  characterOwnerParts,
  guildClassLabel,
  isChangeJobSkill,
  isLevelUpSkill,
  isTeacherExpSkill,
  levelUpTargetLevel,
} from '@/types/game';

type EventKindFilter = 'LAUNCHED' | 'AFFECTED';
type DateSort = 'desc' | 'asc';
type DateSortField = 'request' | 'review';

const EVENT_COLS = [
  { key: 'id', label: 'ID', flex: 0.75, minWidth: 88 },
  { key: 'guild', label: 'Guild', flex: 1.1 },
  { key: 'skill', label: 'Skill', flex: 1.5 },
  { key: 'from', label: 'From', flex: 1.25 },
  { key: 'target', label: 'Target', flex: 1.25 },
  { key: 'status', label: 'Status', flex: 0.7, minWidth: 88 },
  { key: 'actions', label: 'Actions', flex: 1.1 },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

/** Teacher EXP comment: preferred `+50` / `-25`; also accept legacy "Granted +N ..." / "Removed -N ..." */
function parseExpDeltaComment(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const trimmed = comment.trim();
  if (/^[+-]\d+$/.test(trimmed)) return trimmed;
  const granted = trimmed.match(/Granted\s*\+(\d+)/i);
  if (granted) return `+${granted[1]}`;
  const removed = trimmed.match(/Removed\s*-(\d+)/i);
  if (removed) return `-${removed[1]}`;
  return null;
}

function isExpDeltaComment(comment: string | null | undefined): boolean {
  return parseExpDeltaComment(comment) != null;
}

function teacherExpScope(event: GameEvent): 'character' | 'party' | 'guild' {
  if (event.target_character_id != null) return 'character';
  if (event.target_party_id != null) return 'party';
  return 'guild';
}

function teacherExpSummary(
  event: GameEvent,
  skill: Skill | undefined,
  teacherName: string | null,
  targetLabel: string
): string | null {
  const looksTeacher =
    skill?.job === 'Teacher' ||
    (event.caster_character_id == null && isExpDeltaComment(event.comment));
  if (!looksTeacher) return null;
  const delta = parseExpDeltaComment(event.comment);
  if (!delta) return null;
  const who = teacherName?.trim() || 'Teacher';
  const target = targetLabel.trim() || teacherExpScope(event);
  return `${who} ${delta} EXP to ${target}`;
}

function isTeacherExpEvent(event: GameEvent, skill: Skill | undefined): boolean {
  if (skill && isTeacherExpSkill(skill)) return true;
  return event.caster_character_id == null && isExpDeltaComment(event.comment);
}

function parseChangeJobTarget(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const match = comment.match(/Change Job to\s+(\w+)/i);
  if (match) return match[1];
  const bare = comment.trim();
  if (/^(Mage|Rogue|Paladin)$/i.test(bare)) return bare;
  return null;
}

function progressionSummary(
  event: GameEvent,
  skill: Skill | undefined,
  characterName: string | null
): string | null {
  if (!skill) return null;
  const name = characterName?.trim() || 'Character';
  if (isLevelUpSkill(skill)) {
    const lvl = levelUpTargetLevel(skill);
    if (lvl == null) return null;
    return `${name} level up to lvl ${lvl}`;
  }
  if (isChangeJobSkill(skill)) {
    const job = parseChangeJobTarget(event.comment);
    if (!job) return null;
    const jobEn = job.charAt(0).toUpperCase() + job.slice(1).toLowerCase();
    return `${name} is now a ${jobEn}`;
  }
  return null;
}

function eventTime(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export default function EventsScreen() {
  const isDesktop = useIsDesktop();
  const session = useAuthStore((state) => state.session);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const refreshCharacters = useCharacterStore((state) => state.refreshCharacters);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);
  const myCharacters = useCharacterStore((state) => state.characters);

  const [allVisibleCharacters, setAllVisibleCharacters] = useState<Character[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilters, setKindFilters] = useState<EventKindFilter[]>([]);
  const [statusFilters, setStatusFilters] = useState<EventStatus[]>([]);
  const [dateSort, setDateSort] = useState<DateSort>('desc');
  const [dateSortField, setDateSortField] = useState<DateSortField>('request');
  const [expandedEventIds, setExpandedEventIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [snackbar, setSnackbar] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session) return;
        setLoading(true);
        try {
          const [mine, skillsData, allGuilds] = await Promise.all([
            refreshCharacters(),
            getSkills(),
            getGuilds(),
          ]);
          if (!active) return;
          setSkills(skillsData);
          setGuilds(allGuilds);

          const character =
            mine.find((c) => c.id === useCharacterStore.getState().selectedCharacterId) ?? null;

          if (!character) {
            setAllVisibleCharacters([]);
            setParties([]);
            setUsers([]);
            setEvents([]);
            return;
          }

          const [guildCharacters, guildParties, guildUsers, eventsData] = await Promise.all([
            getCharacters(character.guild_id),
            getParties(character.guild_id),
            getUsers(character.guild_id),
            getEvents(character.guild_id),
          ]);
          if (!active) return;
          setAllVisibleCharacters(guildCharacters);
          setParties(guildParties);
          setUsers(guildUsers);
          setEvents(eventsData);
        } finally {
          if (active) setLoading(false);
        }
      }
      load();
      return () => {
        active = false;
      };
    }, [session, refreshCharacters, selectedCharacterId])
  );

  const guildById = useMemo(() => new Map(guilds.map((g) => [g.id, g])), [guilds]);
  const characterById = useMemo(
    () => new Map(allVisibleCharacters.map((c) => [c.id, c])),
    [allVisibleCharacters]
  );
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const myCharacterIds = useMemo(
    () => new Set(myCharacters.map((character) => character.id)),
    [myCharacters]
  );

  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      if (!selectedCharacter) return false;
      const skill = skillById.get(event.skill_id);
      if (!isStudentEventVisibleForCharacter(event, selectedCharacter, skill, myCharacterIds)) {
        return false;
      }

      const launched = event.caster_character_id === selectedCharacter.id;
      const affected = !launched;
      const kindAllowed =
        kindFilters.length === 0 ||
        (launched && kindFilters.includes('LAUNCHED')) ||
        (affected && kindFilters.includes('AFFECTED'));
      const statusAllowed =
        statusFilters.length === 0 || statusFilters.includes(event.status);
      if (!kindAllowed || !statusAllowed) return false;

      const guild = guildById.get(event.guild_id);
      const caster =
        event.caster_character_id != null ? characterById.get(event.caster_character_id) : undefined;
      const targetCharacter =
        event.target_character_id != null ? characterById.get(event.target_character_id) : null;
      const targetParty = event.target_party_id != null ? partyById.get(event.target_party_id) : null;
      const reviewer =
        event.reviewed_by_user_id != null
          ? (userById.get(event.reviewed_by_user_id)?.name ??
              (event.reviewed_by_user_id === session?.id ? session?.name : null) ??
              'Mentor')
          : null;

      return eventMatchesSearch(searchQuery, event, {
        skill,
        guild,
        caster,
        targetCharacter,
        targetParty,
        userById,
        reviewerName: reviewer,
      });
    });

    return filtered.sort((a, b) => {
      if (dateSortField === 'review') {
        const aHas = a.reviewed_at != null;
        const bHas = b.reviewed_at != null;
        if (aHas !== bHas) return aHas ? -1 : 1;
        const diff = eventTime(a.reviewed_at ?? '') - eventTime(b.reviewed_at ?? '');
        return dateSort === 'asc' ? diff : -diff;
      }
      const diff = eventTime(a.created_at) - eventTime(b.created_at);
      return dateSort === 'asc' ? diff : -diff;
    });
  }, [
    characterById,
    dateSort,
    dateSortField,
    events,
    guildById,
    kindFilters,
    myCharacterIds,
    partyById,
    searchQuery,
    selectedCharacter,
    session?.id,
    session?.name,
    skillById,
    statusFilters,
    userById,
  ]);

  const toggleFiltersExpanded = () => {
    setFiltersExpanded((prev) => !prev);
  };
  const toggleKind = (value: EventKindFilter) => {
    setKindFilters((prev) => (prev.includes(value) ? [] : [value]));
  };
  const toggleStatus = (value: EventStatus) => {
    setStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };
  const toggleDateSort = (field: DateSortField) => {
    if (dateSortField === field) {
      setDateSort((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setDateSortField(field);
    setDateSort('desc');
  };

  const toggleCommentVisible = (eventId: number) => {
    setExpandedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const cancelPendingEvent = (event: GameEvent) => {
    if (cancellingId != null) return;
    const skill = skillById.get(event.skill_id);
    const cost = skill?.exp_cost ?? 0;
    showConfirm(
      'Cancel event',
      `Cancel #${event.id} and refund ${cost} EXP to your character?`,
      async () => {
        setCancellingId(event.id);
        try {
          await deleteEvent(event.id);
          setEvents((prev) => prev.filter((e) => e.id !== event.id));
          await refreshCharacters();
          setSnackbar('Event cancelled. EXP refunded.');
        } catch (error) {
          setSnackbar(apiErrorMessage(error, 'Could not cancel event.'));
        } finally {
          setCancellingId(null);
        }
      }
    );
  };

  if (!selectedCharacterId) return <Redirect href="/(student)/alumno1" />;

  if (loading && !selectedCharacter) {
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

  const renderEventCard = (event: GameEvent) => {
    const caster =
      event.caster_character_id != null
        ? characterById.get(event.caster_character_id)
        : undefined;
    const targetCharacter =
      event.target_character_id !== null
        ? characterById.get(event.target_character_id)
        : null;
    const targetParty =
      event.target_party_id !== null ? partyById.get(event.target_party_id) : null;
    const skill = skillById.get(event.skill_id);
    const launchedBySelected =
      event.caster_character_id != null &&
      event.caster_character_id === selectedCharacter.id;
    const receivedByCharacter = event.target_character_id === selectedCharacter.id;
    const receivedByParty =
      selectedCharacter.party_id !== null &&
      event.target_party_id === selectedCharacter.party_id;
    const teacherExp = isTeacherExpEvent(event, skill);
    const isGuildTarget =
      event.target_character_id === null &&
      event.target_party_id === null &&
      (skill?.aoe === 'GUILD' || teacherExp);
    const guildWideForSelected =
      isGuildTarget && event.guild_id === selectedCharacter.guild_id;

    let targetKind: 'character' | 'party' | 'guild' | null = null;
    let targetShort = '';
    let targetDisplay = '';
    let targetOwner: string | null = null;
    let targetHighlight = false;
    const eventGuild = guildById.get(event.guild_id);
    const eventGuildClass = guildClassLabel(eventGuild);
    if (event.target_character_id !== null) {
      targetKind = 'character';
      const parts = characterOwnerParts(targetCharacter ?? undefined, userById);
      targetShort = parts.name;
      targetOwner = parts.owner;
      targetDisplay = characterOwnerLabel(targetCharacter ?? undefined, userById);
      targetHighlight = receivedByCharacter;
    } else if (event.target_party_id !== null) {
      targetKind = 'party';
      const partyName = targetParty?.name ?? 'Unknown party';
      targetShort = `${partyName} party`;
      targetDisplay = partyName;
      targetHighlight = receivedByParty;
    } else if (isGuildTarget) {
      targetKind = 'guild';
      const guildName = eventGuild?.name ?? 'guild';
      targetShort = `${guildName} guild`;
      targetDisplay = guildName;
      targetHighlight = guildWideForSelected;
    }

    const targetPrefix =
      targetKind === 'character' ? 'Char' : targetKind === 'party' ? 'Party' : 'Guild';
    const commentVisible = expandedEventIds.includes(event.id);
    const cardClass = eventStatusCardClass(event.status);
    const reviewer =
      event.reviewed_by_user_id != null
        ? (userById.get(event.reviewed_by_user_id)?.name ??
            (event.reviewed_by_user_id === session?.id ? session?.name : null) ??
            'Mentor')
        : null;
    const expSummary = teacherExpSummary(event, skill, reviewer, targetShort);
    const isTeacherExp = Boolean(expSummary);
    const characterName =
      caster?.name ??
      (event.target_character_id != null
        ? characterById.get(event.target_character_id)?.name
        : null) ??
      null;
    const progression = progressionSummary(event, skill, characterName);
    const isAutoProgression = Boolean(progression);
    const hasDisplayComment =
      Boolean(event.comment) && !isExpDeltaComment(event.comment) && !isAutoProgression;
    const hideFromRow = isTeacherExp || isAutoProgression;
    const badge = eventStatusBadgeClass(event.status);
    const reviewMeta =
      (event.status === 'APPROVED' || event.status === 'REJECTED') && event.reviewed_at
        ? `Reviewed ${formatEventDate(event.reviewed_at)}${reviewer ? ` · ${reviewer}` : ''}`
        : null;
    const reviewChip = reviewMeta ? eventReviewChipColors(event.status) : null;

    const skillTitle =
      skill?.name ??
      (isTeacherExpEvent(event, skill)
        ? parseExpDeltaComment(event.comment)?.startsWith('-')
          ? 'Remove EXP'
          : 'Grant EXP'
        : 'Unknown skill');
    const fromLabel = caster ? characterOwnerLabel(caster, userById) : (reviewer ?? 'Teacher');
    const skillSecondary = expSummary ?? progression ?? null;
    const canCancel = launchedBySelected && event.status === 'PENDING';

    if (isDesktop) {
      return (
        <Card key={event.id} mode="outlined" className={cardClass}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}>
            <DesktopCell flex={0.75} minWidth={88}>
              <DesktopCellText primary={`#${event.id}`} secondary={formatEventDate(event.created_at)} />
            </DesktopCell>
            <DesktopCell flex={1.1}>
              <DesktopCellText primary={eventGuildClass || '—'} />
            </DesktopCell>
            <DesktopCell flex={1.5}>
              <DesktopCellText primary={skillTitle} secondary={skillSecondary} />
              {hasDisplayComment ? (
                <View style={{ marginTop: 4 }}>
                  <EventCommentChip
                    label={commentVisible ? (event.comment ?? '') : 'View comment'}
                    muted={!commentVisible}
                    onPress={() => toggleCommentVisible(event.id)}
                  />
                </View>
              ) : null}
            </DesktopCell>
            <DesktopCell flex={1.25}>
              {!hideFromRow ? (
                <DesktopCellText
                  primary={fromLabel}
                  primaryStyle={highlightNameStyle(launchedBySelected)}
                />
              ) : (
                <DesktopCellText primary="—" />
              )}
            </DesktopCell>
            <DesktopCell flex={1.25}>
              {targetKind ? (
                <DesktopCellText
                  primary={targetDisplay}
                  secondary={targetPrefix}
                  primaryStyle={highlightNameStyle(targetHighlight)}
                />
              ) : (
                <DesktopCellText primary="—" />
              )}
            </DesktopCell>
            <DesktopCell flex={0.7} minWidth={88}>
              <View
                className={badge.wrap}
                style={{ position: 'relative', top: 0, right: 0, alignSelf: 'flex-start' }}>
                <Text className={badge.text}>{badge.label}</Text>
              </View>
              {reviewMeta && reviewChip ? (
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: '600',
                    color: reviewChip.text,
                  }}>
                  {reviewMeta}
                </Text>
              ) : null}
            </DesktopCell>
            <DesktopCell flex={1.1}>
              {canCancel ? (
                <Chip
                  mode="outlined"
                  icon="close-circle-outline"
                  disabled={cancellingId === event.id}
                  onPress={() => cancelPendingEvent(event)}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#450a0a',
                    borderWidth: 1,
                    borderColor: '#ef4444',
                  }}
                  textStyle={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#fecaca',
                    flexShrink: 1,
                  }}>
                  {cancellingId === event.id ? 'Cancelling…' : 'Cancel'}
                </Chip>
              ) : (
                <Text style={{ color: GM.tertiary }}>—</Text>
              )}
            </DesktopCell>
          </View>
        </Card>
      );
    }

    return (
      <Card
        key={event.id}
        mode="outlined"
        className={cardClass}>
        <View pointerEvents="none" className={badge.wrap}>
          <Text className={badge.text}>{badge.label}</Text>
        </View>
        <Card.Content style={{ gap: 6, paddingVertical: 12, paddingHorizontal: 12, paddingRight: 72 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
              <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                #{event.id}
              </Text>
              <Text variant="labelSmall" className={mutedLabelClass}>
                {formatEventDate(event.created_at)}
              </Text>
            </View>

            <Text variant="labelMedium" style={{ color: GM.onSurfaceVariant, fontWeight: '600' }}>
              {eventGuildClass}
            </Text>

            <Text style={{ fontWeight: '700' }} numberOfLines={2}>
              {skillTitle}
            </Text>

            {!hideFromRow ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                  From:{' '}
                  <Text style={highlightNameStyle(launchedBySelected)}>
                    {fromLabel}
                  </Text>
                </Text>
                {targetKind ? (
                  <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                    · {targetPrefix}:{' '}
                    <Text style={highlightNameStyle(targetHighlight)}>
                      {targetDisplay}
                    </Text>
                  </Text>
                ) : null}
              </View>
            ) : null}

            {isTeacherExp && expSummary ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 2,
                  alignItems: 'center',
                }}>
                <Chip
                  icon="lightning-bolt"
                  style={{ alignSelf: 'flex-start' }}
                  textStyle={{
                    flexShrink: 1,
                    ...(highlightNameStyle(targetHighlight) ?? {}),
                  }}>
                  {expSummary}
                </Chip>
                {targetOwner ? (
                  <Chip
                    compact
                    style={{ alignSelf: 'flex-start' }}
                    textStyle={{
                      flexShrink: 1,
                      ...(highlightNameStyle(targetHighlight) ?? {}),
                    }}>
                    {targetOwner}
                  </Chip>
                ) : null}
              </View>
            ) : isAutoProgression && progression ? (
              <Chip
                icon="information-outline"
                style={{ alignSelf: 'flex-start', marginTop: 2 }}
                textStyle={{
                  flexShrink: 1,
                  ...(highlightNameStyle(launchedBySelected || targetHighlight) ?? {}),
                }}>
                {progression}
              </Chip>
            ) : null}

            {reviewMeta && reviewChip ? (
              <Chip
                icon={reviewChip.icon}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  backgroundColor: reviewChip.bg,
                  borderWidth: 1,
                  borderColor: reviewChip.border,
                }}
                textStyle={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: reviewChip.text,
                  flexShrink: 1,
                }}>
                {reviewMeta}
              </Chip>
            ) : null}

            {hasDisplayComment ? (
              <EventCommentChip
                label={commentVisible ? (event.comment ?? '') : 'View comment'}
                muted={!commentVisible}
                onPress={() => toggleCommentVisible(event.id)}
              />
            ) : null}

            {canCancel ? (
              <Chip
                mode="outlined"
                icon="close-circle-outline"
                disabled={cancellingId === event.id}
                onPress={() => cancelPendingEvent(event)}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  backgroundColor: '#450a0a',
                  borderWidth: 1,
                  borderColor: '#ef4444',
                }}
                textStyle={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#fecaca',
                  flexShrink: 1,
                }}>
                {cancellingId === event.id ? 'Cancelling…' : 'Cancel event'}
              </Chip>
            ) : null}
          </Card.Content>
      </Card>
    );
  };

  return (
    <View className={screenClass}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16, gap: 8 }}
        keyboardShouldPersistTaps="handled">
        <Card mode="outlined" className={filtersCardClass}>
          <Pressable
            onPress={toggleFiltersExpanded}
            android_ripple={{ color: GM.surfaceElevated }}
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
            <View className="gm-filters-header">
              <Icon source="filter-variant" size={22} color={GM.primary} />
              <Text className="flex-1 text-base font-bold gm-text-on-bg">Filters</Text>
              <Icon
                source={filtersExpanded ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={GM.tertiary}
              />
            </View>
          </Pressable>
          {filtersExpanded ? (
            <Card.Content style={{ paddingTop: 0, paddingBottom: 12, gap: 8 }}>
              <CompactSearchField
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search events…"
                height={40}
              />

              <View style={{ gap: 4 }}>
                <Text variant="labelSmall" className={mutedLabelClass}>
                  Kind (one)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <Chip
                    selected={kindFilters.includes('LAUNCHED')}
                    onPress={() => toggleKind('LAUNCHED')}>
                    Launched
                  </Chip>
                  <Chip
                    selected={kindFilters.includes('AFFECTED')}
                    onPress={() => toggleKind('AFFECTED')}>
                    Received
                  </Chip>
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Text variant="labelSmall" className={mutedLabelClass}>
                  Status (multi)
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <Chip
                    selected={statusFilters.includes('PENDING')}
                    onPress={() => toggleStatus('PENDING')}>
                    Pending
                  </Chip>
                  <Chip
                    selected={statusFilters.includes('APPROVED')}
                    onPress={() => toggleStatus('APPROVED')}>
                    Approved
                  </Chip>
                  <Chip
                    selected={statusFilters.includes('REJECTED')}
                    onPress={() => toggleStatus('REJECTED')}>
                    Rejected
                  </Chip>
                  <Chip selected={statusFilters.includes('AUTO')} onPress={() => toggleStatus('AUTO')}>
                    Auto
                  </Chip>
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Text variant="labelSmall" className={mutedLabelClass}>
                  Sort by date
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <Chip
                    icon={
                      dateSortField === 'request'
                        ? dateSort === 'desc'
                          ? 'sort-calendar-descending'
                          : 'sort-calendar-ascending'
                        : 'calendar'
                    }
                    selected={dateSortField === 'request'}
                    onPress={() => toggleDateSort('request')}>
                    {dateSortField === 'request' && dateSort === 'asc'
                      ? 'Request date · oldest'
                      : 'Request date · newest'}
                  </Chip>
                  <Chip
                    icon={
                      dateSortField === 'review'
                        ? dateSort === 'desc'
                          ? 'sort-calendar-descending'
                          : 'sort-calendar-ascending'
                        : 'calendar-check'
                    }
                    selected={dateSortField === 'review'}
                    onPress={() => toggleDateSort('review')}>
                    {dateSortField === 'review' && dateSort === 'asc'
                      ? 'Review date · oldest'
                      : 'Review date · newest'}
                  </Chip>
                </View>
              </View>
            </Card.Content>
          ) : null}
        </Card>

        <Card mode="outlined">
          <Card.Content style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
            <Text variant="titleSmall">Events ({filteredEvents.length})</Text>
          </Card.Content>
        </Card>

        {isDesktop && filteredEvents.length ? (
          <DesktopListHeader columns={EVENT_COLS} />
        ) : null}

        {filteredEvents.map(renderEventCard)}
        {!filteredEvents.length ? <Text>No events.</Text> : null}
      </ScrollView>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={2500}>
        {snackbar}
      </Snackbar>
    </View>
  );
}
