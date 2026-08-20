import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  Icon,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
} from 'react-native-paper';

import { EventCommentChip } from '@/components/EventCommentChip';
import { eventMatchesSearch } from '@/lib/event-search';
import {
  centerScreenClass,
  eventReviewChipColors,
  eventStatusBadgeClass,
  eventStatusCardClass,
  filtersCardClass,
  GM,
  modalContentStyle,
  mutedLabelClass,
  screenClass,
} from '@/lib/guildmaster-theme';
import {
  apiErrorMessage,
  getCharacters,
  getEvents,
  getGuilds,
  getParties,
  getSkills,
  getUsers,
  updateEvent,
} from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { useGuildStore } from '@/store/guild-store';
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

type EventKindFilter = 'LAUNCHED' | 'REVIEWED';
type DateSort = 'desc' | 'asc';
type DateSortField = 'request' | 'review';

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

export default function TeacherEventsScreen() {
  const session = useAuthStore((state) => state.session);
  const selectedGuildId = useGuildStore((state) => state.selectedGuildId);

  const [guild, setGuild] = useState<Guild | null>(null);
  const [allVisibleCharacters, setAllVisibleCharacters] = useState<Character[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilters, setKindFilters] = useState<EventKindFilter[]>([]);
  const [statusFilters, setStatusFilters] = useState<EventStatus[]>([]);
  const [dateSort, setDateSort] = useState<DateSort>('desc');
  const [dateSortField, setDateSortField] = useState<DateSortField>('request');
  const [expandedEventIds, setExpandedEventIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [reviewEvent, setReviewEvent] = useState<GameEvent | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState('');

  const reloadEvents = useCallback(async () => {
    if (!selectedGuildId) return;
    const eventsData = await getEvents(selectedGuildId);
    setEvents(eventsData);
  }, [selectedGuildId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session || !selectedGuildId) return;
        setLoading(true);
        try {
          const [guilds, skillsData, guildCharacters, guildParties, guildUsers, eventsData] =
            await Promise.all([
              getGuilds(),
              getSkills(),
              getCharacters(selectedGuildId),
              getParties(selectedGuildId),
              getUsers(selectedGuildId),
              getEvents(selectedGuildId),
            ]);
          if (!active) return;
          setGuild(guilds.find((g) => g.id === selectedGuildId) ?? null);
          setSkills(skillsData);
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
    }, [session, selectedGuildId])
  );

  const characterById = useMemo(
    () => new Map(allVisibleCharacters.map((c) => [c.id, c])),
    [allVisibleCharacters]
  );
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const filteredEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      const skill = skillById.get(event.skill_id);
      const launchedByMe = skill?.job === 'Teacher' && event.reviewed_by_user_id === session?.id;
      const reviewedByMe =
        event.reviewed_by_user_id === session?.id && event.reviewed_at != null;
      const kindAllowed =
        kindFilters.length === 0 ||
        (launchedByMe && kindFilters.includes('LAUNCHED')) ||
        (reviewedByMe && kindFilters.includes('REVIEWED'));
      const statusAllowed =
        statusFilters.length === 0 || statusFilters.includes(event.status);
      if (!kindAllowed || !statusAllowed) return false;

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
    guild,
    kindFilters,
    partyById,
    searchQuery,
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

  const openReviewModal = (event: GameEvent) => {
    setReviewEvent(event);
    setReviewComment('');
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) return;
    setReviewEvent(null);
    setReviewComment('');
  };

  const submitReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewEvent) return;
    const comment = reviewComment.trim();
    if (!comment) {
      setSnackbar('Comment is required to approve or reject.');
      return;
    }
    try {
      setReviewSubmitting(true);
      await updateEvent(reviewEvent.id, { status, comment });
      setReviewEvent(null);
      setReviewComment('');
      await reloadEvents();
      setSnackbar(status === 'APPROVED' ? 'Event approved.' : 'Event rejected.');
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not update event.'));
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!selectedGuildId) return <Redirect href="/(teacher)/profe1" />;

  if (loading && !events.length) {
    return (
      <View className={centerScreenClass}>
        <ActivityIndicator />
      </View>
    );
  }

  const renderEventCard = (event: GameEvent) => {
    const caster =
      event.caster_character_id != null ? characterById.get(event.caster_character_id) : undefined;
    const targetCharacter =
      event.target_character_id !== null ? characterById.get(event.target_character_id) : null;
    const targetParty =
      event.target_party_id !== null ? partyById.get(event.target_party_id) : null;
    const skill = skillById.get(event.skill_id);
    const reviewer =
      event.reviewed_by_user_id != null
        ? (userById.get(event.reviewed_by_user_id)?.name ??
            (event.reviewed_by_user_id === session?.id ? session?.name : null) ??
            'Mentor')
        : null;

    let targetKind: 'character' | 'party' | 'guild' | null = null;
    let targetShort = '';
    let targetDisplay = '';
    let targetOwner: string | null = null;
    const eventGuildClass = guildClassLabel(guild);
    if (event.target_character_id !== null) {
      targetKind = 'character';
      const parts = characterOwnerParts(targetCharacter ?? undefined, userById);
      targetShort = parts.name;
      targetOwner = parts.owner;
      targetDisplay = characterOwnerLabel(targetCharacter ?? undefined, userById);
    } else if (event.target_party_id !== null) {
      targetKind = 'party';
      const partyName = targetParty?.name ?? 'Unknown party';
      targetShort = `${partyName} party`;
      targetDisplay = partyName;
    } else if (
      event.target_character_id === null &&
      event.target_party_id === null &&
      (skill?.aoe === 'GUILD' || skill?.job === 'Teacher')
    ) {
      targetKind = 'guild';
      const guildName = guild?.name ?? 'guild';
      targetShort = `${guildName} guild`;
      targetDisplay = guildName;
    }

    const targetPrefix =
      targetKind === 'character' ? 'Char' : targetKind === 'party' ? 'Party' : 'Guild';
    const commentVisible = expandedEventIds.includes(event.id);
    const cardClass = eventStatusCardClass(event.status);
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
              {skill?.name ??
                (isTeacherExpEvent(event, skill)
                  ? parseExpDeltaComment(event.comment)?.startsWith('-')
                    ? 'Remove EXP'
                    : 'Grant EXP'
                  : 'Unknown skill')}
            </Text>

            {!hideFromRow ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                  From:{' '}
                  <Text style={{ fontWeight: '600' }}>
                    {caster ? characterOwnerLabel(caster, userById) : (reviewer ?? 'Teacher')}
                  </Text>
                </Text>
                {targetKind ? (
                  <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                    · {targetPrefix}:{' '}
                    <Text style={{ fontWeight: '600' }}>{targetDisplay}</Text>
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
                  textStyle={{ flexShrink: 1 }}>
                  {expSummary}
                </Chip>
                {targetOwner ? (
                  <Chip compact style={{ alignSelf: 'flex-start' }} textStyle={{ flexShrink: 1 }}>
                    {targetOwner}
                  </Chip>
                ) : null}
              </View>
            ) : isAutoProgression && progression ? (
              <Chip
                icon="information-outline"
                style={{ alignSelf: 'flex-start', marginTop: 2 }}
                textStyle={{ flexShrink: 1 }}>
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

            {event.status === 'PENDING' ? (
              <Chip
                mode="outlined"
                icon="clipboard-check-outline"
                onPress={() => openReviewModal(event)}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  backgroundColor: '#422006',
                  borderWidth: 1,
                  borderColor: '#eab308',
                }}
                textStyle={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#fde68a',
                  flexShrink: 1,
                }}>
                Approve or reject
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
              <TextInput
                mode="outlined"
                dense
                placeholder="Search events…"
                value={searchQuery}
                onChangeText={setSearchQuery}
                left={<TextInput.Icon icon="magnify" />}
                right={
                  searchQuery ? (
                    <TextInput.Icon icon="close" onPress={() => setSearchQuery('')} />
                  ) : undefined
                }
                className="gm-input-inverse"
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
                    selected={kindFilters.includes('REVIEWED')}
                    onPress={() => toggleKind('REVIEWED')}>
                    Reviewed
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

        {filteredEvents.map(renderEventCard)}
        {!filteredEvents.length ? <Text>No events.</Text> : null}
      </ScrollView>

      <Portal>
        <Modal
          visible={Boolean(reviewEvent)}
          onDismiss={closeReviewModal}
          contentContainerStyle={modalContentStyle}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleMedium">Review event #{reviewEvent?.id}</Text>
            <Text style={{ marginTop: 4 }}>
              {reviewEvent ? (skillById.get(reviewEvent.skill_id)?.name ?? 'Unknown skill') : ''}
            </Text>
            <Divider style={{ marginVertical: 10 }} />

            <Text variant="titleSmall">Comment (required)</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Justify approve or reject"
              value={reviewComment}
              onChangeText={setReviewComment}
              style={{ marginTop: 6 }}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 16,
              }}>
              <Button onPress={closeReviewModal} disabled={reviewSubmitting}>
                Close
              </Button>
              <Button
                mode="outlined"
                textColor={GM.primary}
                loading={reviewSubmitting}
                onPress={() => submitReview('REJECTED')}>
                Reject
              </Button>
              <Button
                mode="contained"
                buttonColor={GM.primaryContainer}
                textColor={GM.onPrimary}
                loading={reviewSubmitting}
                onPress={() => submitReview('APPROVED')}>
                Approve
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar('')} duration={3000}>
        {snackbar}
      </Snackbar>
    </View>
  );
}
