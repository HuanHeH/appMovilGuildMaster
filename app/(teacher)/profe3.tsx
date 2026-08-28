import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Icon,
  IconButton,
  List,
  Modal,
  Portal,
  Snackbar,
  Text,
  TextInput,
  TouchableRipple,
} from 'react-native-paper';

import { EventCommentChip } from '@/components/EventCommentChip';
import { CompactSearchField } from '@/components/CompactSearchField';
import {
  DesktopCell,
  DesktopCellText,
  DesktopListHeader,
} from '@/components/DesktopListRow';
import { showConfirm } from '@/lib/alert';
import { eventMatchesSearch } from '@/lib/event-search';
import {
  centerScreenClass,
  eventReviewChipColors,
  eventStatusBadgeClass,
  eventStatusCardClass,
  filtersCardClass,
  GM,
  highlightNameStyle,
  modalContentStyle,
  mutedLabelClass,
  screenClass,
} from '@/lib/guildmaster-theme';
import {
  apiErrorMessage,
  createParty,
  deleteParty,
  getCharacters,
  getEvents,
  getGuilds,
  getParties,
  getSkills,
  getUsers,
  updateCharacterParty,
  updateEvent,
  updateParty,
} from '@/lib/api';
import { useIsDesktop } from '@/lib/use-is-desktop';
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

const EVENT_COLS = [
  { key: 'id', label: 'ID', flex: 0.75, minWidth: 88 },
  { key: 'guild', label: 'Guild', flex: 1.1 },
  { key: 'skill', label: 'Skill', flex: 1.5 },
  { key: 'from', label: 'From', flex: 1.25 },
  { key: 'target', label: 'Target', flex: 1.25 },
  { key: 'status', label: 'Status', flex: 0.7, minWidth: 88 },
  { key: 'actions', label: 'Actions', flex: 1.2 },
];

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
  const isDesktop = useIsDesktop();
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
  const [reviewSubmittingAction, setReviewSubmittingAction] = useState<
    'APPROVED' | 'REJECTED' | 'REVERT' | null
  >(null);
  const reviewBusy = reviewSubmittingAction != null;
  const [snackbar, setSnackbar] = useState('');

  // Party management state
  const [partyModalVisible, setPartyModalVisible] = useState(false);
  const [partyModalMode, setPartyModalMode] = useState<'create' | 'rename'>('create');
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyName, setPartyName] = useState('');
  const [partySubmitting, setPartySubmitting] = useState(false);
  const [partyExpanded, setPartyExpanded] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignPartyId, setAssignPartyId] = useState<number | null>(null);
  const [assignCharacterIds, setAssignCharacterIds] = useState<number[]>([]);

  const reloadGuildData = useCallback(async () => {
    if (!selectedGuildId) return;
    const [chars, partiesData] = await Promise.all([
      getCharacters(selectedGuildId),
      getParties(selectedGuildId),
    ]);
    setAllVisibleCharacters(chars);
    setParties(partiesData);
  }, [selectedGuildId]);

  const reloadParties = useCallback(async () => {
    if (!selectedGuildId) return;
    const partiesData = await getParties(selectedGuildId);
    setParties(partiesData);
  }, [selectedGuildId]);

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
    if (reviewBusy) return;
    setReviewEvent(null);
    setReviewComment('');
  };

  const submitReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!reviewEvent || reviewBusy) return;
    const comment = reviewComment.trim();
    if (!comment) {
      setSnackbar('Comment is required to approve or reject.');
      return;
    }
    try {
      setReviewSubmittingAction(status);
      await updateEvent(reviewEvent.id, { status, comment });
      setReviewEvent(null);
      setReviewComment('');
      await reloadEvents();
      setSnackbar(status === 'APPROVED' ? 'Event approved.' : 'Event rejected.');
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not update event.'));
    } finally {
      setReviewSubmittingAction(null);
    }
  };

  const revertToPending = (event: GameEvent) => {
    if (reviewBusy) return;
    const hint =
      event.status === 'APPROVED'
        ? 'Debuff target gifts (if any) will be clawed back.'
        : 'Caster will be charged ExpCost again (reject refund is undone).';
    showConfirm(
      'Return to pending',
      `Set #${event.id} back to PENDING?\n${hint}`,
      async () => {
        try {
          setReviewSubmittingAction('REVERT');
          await updateEvent(event.id, { status: 'PENDING', comment: null });
          await reloadEvents();
          setSnackbar('Event returned to pending.');
        } catch (error) {
          setSnackbar(apiErrorMessage(error, 'Could not revert event.'));
        } finally {
          setReviewSubmittingAction(null);
        }
      }
    );
  };

  // --- Party management ---
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
    if (!trimmed) {
      setSnackbar('Party name is required.');
      return;
    }
    try {
      setPartySubmitting(true);
      if (partyModalMode === 'create') {
        await createParty({ name: trimmed, guildId: selectedGuildId });
        setSnackbar('Party created.');
      } else if (editingParty) {
        await updateParty(editingParty.id, { name: trimmed });
        setSnackbar('Party renamed.');
      }
      setPartyModalVisible(false);
      await reloadParties();
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not save party.'));
    } finally {
      setPartySubmitting(false);
    }
  };
  const handleDeleteParty = (party: Party) => {
    showConfirm('Delete party', `Delete "${party.name}"? Characters in this party will be unassigned.`, async () => {
      try {
        await deleteParty(party.id);
        setSnackbar('Party deleted.');
        await reloadParties();
        await reloadGuildData();
      } catch (error) {
        setSnackbar(apiErrorMessage(error, 'Could not delete party.'));
      }
    });
  };
  const openAssignCharacters = (partyId: number) => {
    setAssignPartyId(partyId);
    const assigned = allVisibleCharacters
      .filter((c) => c.party_id === partyId)
      .map((c) => c.id);
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
      setPartySubmitting(true);
      const current = allVisibleCharacters.filter((c) => c.party_id === assignPartyId).map((c) => c.id);
      const toRemove = current.filter((id) => !assignCharacterIds.includes(id));
      const toAdd = assignCharacterIds.filter((id) => !current.includes(id));
      for (const id of toRemove) {
        await updateCharacterParty(id, null);
      }
      for (const id of toAdd) {
        await updateCharacterParty(id, assignPartyId);
      }
      setAssignModalVisible(false);
      await reloadParties();
      await reloadGuildData();
      setSnackbar('Party characters updated.');
    } catch (error) {
      setSnackbar(apiErrorMessage(error, 'Could not update party characters.'));
    } finally {
      setPartySubmitting(false);
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

  const renderEventCard = (event: GameEvent, options?: { hideReviewAction?: boolean }) => {
    const hideReviewAction = options?.hideReviewAction === true;
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
    const eventGuildClass = guildClassLabel(guild ?? undefined);
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
    const launchedByMe =
      Boolean(session?.id) &&
      ((event.caster_character_id == null && event.reviewed_by_user_id === session?.id) ||
        (caster != null && caster.user_id === session?.id));
    const targetHighlight =
      Boolean(session?.id) &&
      targetKind === 'character' &&
      targetCharacter?.user_id === session?.id;
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
    const canReview = !hideReviewAction && event.status === 'PENDING';
    const canRevert =
      !hideReviewAction &&
      (event.status === 'APPROVED' || event.status === 'REJECTED') &&
      !isTeacherExp &&
      !isAutoProgression;

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
                  primaryStyle={highlightNameStyle(launchedByMe)}
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
            <DesktopCell flex={1.2}>
              {canReview ? (
                <Chip
                  mode="outlined"
                  icon="clipboard-check-outline"
                  onPress={() => openReviewModal(event)}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#422006',
                    borderWidth: 1,
                    borderColor: '#eab308',
                  }}
                  textStyle={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#fde68a',
                    flexShrink: 1,
                  }}>
                  Review
                </Chip>
              ) : canRevert ? (
                <Chip
                  mode="outlined"
                  icon="undo"
                  disabled={reviewBusy}
                  onPress={() => revertToPending(event)}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#1e3a5f',
                    borderWidth: 1,
                    borderColor: '#60a5fa',
                  }}
                  textStyle={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#bfdbfe',
                    flexShrink: 1,
                  }}>
                  To pending
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
                  <Text style={highlightNameStyle(launchedByMe)}>
                    {fromLabel}
                  </Text>
                </Text>
                {targetKind ? (
                  <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                    · {targetPrefix}:{' '}
                    <Text style={highlightNameStyle(targetHighlight)}>{targetDisplay}</Text>
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
                    ...(highlightNameStyle(launchedByMe || targetHighlight) ?? {}),
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
                  ...(highlightNameStyle(launchedByMe || targetHighlight) ?? {}),
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

            {canReview ? (
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

            {canRevert ? (
              <Chip
                mode="outlined"
                icon="undo"
                disabled={reviewBusy}
                onPress={() => revertToPending(event)}
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 6,
                  backgroundColor: '#1e3a5f',
                  borderWidth: 1,
                  borderColor: '#60a5fa',
                }}
                textStyle={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#bfdbfe',
                  flexShrink: 1,
                }}>
                Return to pending
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
        <Card mode="outlined">
          <Pressable
            onPress={() => setPartyExpanded(!partyExpanded)}
            android_ripple={{ color: GM.surfaceElevated }}
            style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
            <View className="gm-filters-header">
              <Icon source="account-group" size={22} color={GM.primary} />
              <Text className="flex-1 text-base font-bold gm-text-on-bg">
                Parties ({parties.length})
              </Text>
              <Button compact mode="contained" onPress={openCreateParty} icon="plus" style={{ marginRight: 8 }}>
                New
              </Button>
              <Icon
                source={partyExpanded ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={GM.tertiary}
              />
            </View>
          </Pressable>
          {partyExpanded ? (
            <Card.Content style={{ paddingTop: 0, paddingBottom: 12, gap: 8 }}>
              {!parties.length ? (
                <Text style={{ color: GM.tertiary }}>No parties yet. Create one to get started.</Text>
              ) : (
                parties.map((party) => {
                  const members = allVisibleCharacters.filter((c) => c.party_id === party.id);
                  return (
                    <Card key={party.id} mode="outlined" style={{ backgroundColor: GM.surfaceContainer }}>
                      <List.Item
                        title={party.name}
                        description={`${members.length} character${members.length === 1 ? '' : 's'}`}
                        left={(props) => <List.Icon {...props} icon="account-group" color={GM.primary} />}
                        right={() => (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <IconButton
                              icon="account-plus"
                              size={20}
                              onPress={() => openAssignCharacters(party.id)}
                              accessibilityLabel="Assign characters"
                            />
                            <IconButton
                              icon="pencil"
                              size={20}
                              onPress={() => openRenameParty(party)}
                              accessibilityLabel="Rename party"
                            />
                            <IconButton
                              icon="delete"
                              size={20}
                              iconColor={GM.error}
                              onPress={() => handleDeleteParty(party)}
                              accessibilityLabel="Delete party"
                            />
                          </View>
                        )}
                      />
                    </Card>
                  );
                })
              )}
            </Card.Content>
          ) : null}
        </Card>

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

        {isDesktop && filteredEvents.length ? (
          <DesktopListHeader columns={EVENT_COLS} />
        ) : null}

        {filteredEvents.map((event) => renderEventCard(event))}
        {!filteredEvents.length ? <Text>No events.</Text> : null}
      </ScrollView>

      <Portal>
        <Modal
          visible={Boolean(reviewEvent)}
          onDismiss={closeReviewModal}
          contentContainerStyle={modalContentStyle}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleMedium" style={{ marginBottom: 10 }}>
              Review event
            </Text>
            {reviewEvent ? renderEventCard(reviewEvent, { hideReviewAction: true }) : null}
            <Divider style={{ marginVertical: 12 }} />

            <Text variant="titleSmall">Comment (required)</Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              placeholder="Justify approve or reject"
              placeholderTextColor={GM.black}
              value={reviewComment}
              onChangeText={setReviewComment}
              textColor={GM.black}
              className="gm-input-inverse"
              style={{ marginTop: 6, backgroundColor: GM.white }}
              contentStyle={{ backgroundColor: GM.white }}
              theme={{
                colors: {
                  surface: GM.white,
                  onSurface: GM.black,
                  onSurfaceVariant: GM.black,
                  background: GM.white,
                },
              }}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 16,
              }}>
              <Button onPress={closeReviewModal} disabled={reviewBusy}>
                Close
              </Button>
              <Button
                mode="contained"
                buttonColor="#450a0a"
                textColor="#fecaca"
                style={{ borderWidth: 1, borderColor: '#ef4444' }}
                disabled={reviewBusy}
                loading={reviewSubmittingAction === 'REJECTED'}
                onPress={() => submitReview('REJECTED')}>
                Reject
              </Button>
              <Button
                mode="contained"
                buttonColor="#052e16"
                textColor="#bbf7d0"
                style={{ borderWidth: 1, borderColor: '#22c55e' }}
                disabled={reviewBusy}
                loading={reviewSubmittingAction === 'APPROVED'}
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

      {/* Party create/rename modal */}
      <Portal>
        <Modal
          visible={partyModalVisible}
          onDismiss={() => setPartyModalVisible(false)}
          contentContainerStyle={modalContentStyle}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleMedium" style={{ marginBottom: 10 }}>
              {partyModalMode === 'create' ? 'Create party' : 'Rename party'}
            </Text>
            <Divider style={{ marginBottom: 12 }} />
            <TextInput
              mode="outlined"
              label="Party name"
              value={partyName}
              onChangeText={setPartyName}
              maxLength={80}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button onPress={() => setPartyModalVisible(false)}>Cancel</Button>
              <Button mode="contained" loading={partySubmitting} disabled={partySubmitting} onPress={submitParty}>
                {partyModalMode === 'create' ? 'Create' : 'Save'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* Assign characters modal */}
      <Portal>
        <Modal
          visible={assignModalVisible}
          onDismiss={() => setAssignModalVisible(false)}
          contentContainerStyle={modalContentStyle}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text variant="titleMedium" style={{ marginBottom: 10 }}>
              Assign characters
            </Text>
            <Text style={{ color: GM.onSurfaceVariant, marginBottom: 12 }}>
              Select which characters belong to this party.
            </Text>
            <Divider style={{ marginBottom: 8 }} />
            {!allVisibleCharacters.length ? (
              <Text style={{ color: GM.tertiary }}>No characters in this guild yet.</Text>
            ) : (
              allVisibleCharacters.map((character) => {
                const checked = assignCharacterIds.includes(character.id);
                const owner = userById.get(character.user_id)?.name ?? 'Unknown';
                return (
                  <Checkbox.Item
                    key={character.id}
                    label={`${character.name} (${owner})`}
                    status={checked ? 'checked' : 'unchecked'}
                    onPress={() => toggleAssignCharacter(character.id)}
                    position="leading"
                  />
                );
              })
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <Button onPress={() => setAssignModalVisible(false)}>Cancel</Button>
              <Button mode="contained" loading={partySubmitting} disabled={partySubmitting} onPress={submitAssignCharacters}>
                Save
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}
