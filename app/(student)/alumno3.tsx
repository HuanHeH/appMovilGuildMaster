import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, Chip, Text, TouchableRipple } from 'react-native-paper';

import { getCharacters, getEvents, getGuilds, getParties, getSkills, getUsers } from '@/lib/api';
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

function statusCardStyle(status: EventStatus, reviewedAt: string | null) {
  if (status === 'PENDING') {
    return { backgroundColor: '#fefce8', borderColor: '#fde68a' };
  }
  if (status === 'REJECTED') {
    return { backgroundColor: '#fef2f2', borderColor: '#fecaca' };
  }
  if (status === 'AUTO') {
    return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
  }
  // APPROVED with review date
  if (reviewedAt) {
    return { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' };
  }
  return { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' };
}

export default function EventsScreen() {
  const session = useAuthStore((state) => state.session);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const refreshCharacters = useCharacterStore((state) => state.refreshCharacters);
  const selectedCharacter = useCharacterStore(selectSelectedCharacter);

  const [allVisibleCharacters, setAllVisibleCharacters] = useState<Character[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEventIds, setExpandedEventIds] = useState<number[]>([]);

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

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => eventTime(b.created_at) - eventTime(a.created_at));
  }, [events]);

  const toggleEventExpanded = (eventId: number) => {
    setExpandedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  if (!selectedCharacterId) return <Redirect href="/(student)/alumno1" />;

  if (loading && !selectedCharacter) {
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
    const expanded = expandedEventIds.includes(event.id);
    const colors = statusCardStyle(event.status, event.reviewed_at);
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
    const hideFromRow = isTeacherExp || isAutoProgression;

    let statusChipLabel = '';
    if (event.status === 'PENDING') {
      statusChipLabel = 'PENDING';
    } else if (event.status === 'REJECTED') {
      const parts = [event.status];
      if (event.reviewed_at) parts.push(formatEventDate(event.reviewed_at));
      if (reviewer) parts.push(reviewer);
      statusChipLabel = parts.join(' · ');
    } else if (event.status === 'APPROVED' && event.reviewed_at) {
      const parts = [event.status, formatEventDate(event.reviewed_at)];
      if (reviewer) parts.push(reviewer);
      statusChipLabel = parts.join(' · ');
    }

    return (
      <Card
        key={event.id}
        mode="outlined"
        style={{ backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }}>
        <TouchableRipple onPress={() => toggleEventExpanded(event.id)} borderless={false}>
          <Card.Content style={{ gap: 6, paddingVertical: 12, paddingHorizontal: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
                <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                  #{event.id}
                </Text>
                <Text variant="labelSmall" style={{ color: '#6b7280' }}>
                  {formatEventDate(event.created_at)}
                </Text>
              </View>
              {statusChipLabel ? (
                <Chip compact style={{ maxWidth: '100%' }} textStyle={{ flexShrink: 1 }}>
                  {statusChipLabel}
                </Chip>
              ) : null}
            </View>

            <Text variant="labelMedium" style={{ color: '#4b5563', fontWeight: '600' }}>
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
                  <Text
                    style={
                      launchedBySelected
                        ? { color: '#dc2626', fontWeight: '700' }
                        : undefined
                    }>
                    {caster ? characterOwnerLabel(caster, userById) : (reviewer ?? 'Teacher')}
                  </Text>
                </Text>
                {targetKind ? (
                  <Text variant="bodySmall" style={{ flexShrink: 1 }}>
                    · {targetPrefix}:{' '}
                    <Text
                      style={
                        targetHighlight
                          ? { color: '#dc2626', fontWeight: '700' }
                          : undefined
                      }>
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
            ) : event.comment &&
              !isExpDeltaComment(event.comment) &&
              !isAutoProgression ? (
              expanded ? (
                <Chip
                  icon="comment-text-outline"
                  style={{ alignSelf: 'flex-start', marginTop: 2 }}
                  textStyle={{ flexShrink: 1 }}>
                  {event.comment}
                </Chip>
              ) : (
                <Text variant="labelSmall" style={{ color: '#9ca3af', marginTop: 2 }}>
                  Comment · tap to show
                </Text>
              )
            ) : null}
          </Card.Content>
        </TouchableRipple>
      </Card>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16, gap: 8 }}
        keyboardShouldPersistTaps="handled">
        <Text variant="titleMedium">Events ({sortedEvents.length})</Text>
        {sortedEvents.map(renderEventCard)}
        {!sortedEvents.length ? <Text>No events.</Text> : null}
      </ScrollView>
    </View>
  );
}
