import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ActivityIndicator, Card, Checkbox, Chip, Text } from 'react-native-paper';

import { getCharacters, getEvents, getParties, getSkills, getUsers } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { selectSelectedCharacter, useCharacterStore } from '@/store/character-store';
import type { Character, EventStatus, GameEvent, Party, Skill, UserPublic } from '@/types/game';
import { characterOwnerLabel } from '@/types/game';

type EventKindFilter = 'LAUNCHED' | 'AFFECTED';

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
  const [loading, setLoading] = useState(true);
  const [kindFilters, setKindFilters] = useState<EventKindFilter[]>([]);
  const [statusFilters, setStatusFilters] = useState<EventStatus[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session) return;
        setLoading(true);
        try {
          const [mine, skillsData] = await Promise.all([refreshCharacters(), getSkills()]);
          if (!active) return;
          setSkills(skillsData);

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

  const characterById = useMemo(
    () => new Map(allVisibleCharacters.map((c) => [c.id, c])),
    [allVisibleCharacters]
  );
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills]);
  const partyById = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  const relatedEvents = useMemo(() => {
    if (!selectedCharacter) return [];
    return events.filter((event) => {
      const launched = event.caster_character_id === selectedCharacter.id;
      const affectedByCharacter = event.target_character_id === selectedCharacter.id;
      const affectedByParty =
        selectedCharacter.party_id !== null && event.target_party_id === selectedCharacter.party_id;
      const skill = skillById.get(event.skill_id);
      const affectedByGuild =
        event.guild_id === selectedCharacter.guild_id &&
        event.target_character_id === null &&
        event.target_party_id === null &&
        skill?.aoe === 'GUILD';
      return launched || affectedByCharacter || affectedByParty || affectedByGuild;
    });
  }, [events, selectedCharacter, skillById]);

  const filteredEvents = useMemo(() => {
    return relatedEvents.filter((event) => {
      const launched = event.caster_character_id === selectedCharacter?.id;
      const affectedByCharacter = event.target_character_id === selectedCharacter?.id;
      const affectedByParty =
        selectedCharacter?.party_id != null && event.target_party_id === selectedCharacter.party_id;
      const skill = skillById.get(event.skill_id);
      const affectedByGuild =
        selectedCharacter != null &&
        event.guild_id === selectedCharacter.guild_id &&
        event.target_character_id === null &&
        event.target_party_id === null &&
        skill?.aoe === 'GUILD';
      const affected = affectedByCharacter || affectedByParty || affectedByGuild;
      const kindAllowed =
        kindFilters.length === 0 ||
        (launched && kindFilters.includes('LAUNCHED')) ||
        (affected && kindFilters.includes('AFFECTED'));
      const statusAllowed = statusFilters.length === 0 || statusFilters.includes(event.status);
      return kindAllowed && statusAllowed;
    });
  }, [kindFilters, relatedEvents, selectedCharacter, skillById, statusFilters]);

  const toggleKind = (value: EventKindFilter) => {
    setKindFilters((prev) => (prev.includes(value) ? [] : [value]));
  };
  const toggleStatus = (value: EventStatus) => {
    setStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
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

  return (
    <View className="flex-1 bg-white">
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Card mode="outlined">
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">Events for {selectedCharacter.name}</Text>
            <Text>
              {selectedCharacter.job} | Lv.{selectedCharacter.level} | EXP {selectedCharacter.exp}
            </Text>

            <Text variant="titleSmall">Kind (one at a time)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Checkbox.Item
                label="Lanzadas"
                status={kindFilters.includes('LAUNCHED') ? 'checked' : 'unchecked'}
                onPress={() => toggleKind('LAUNCHED')}
              />
              <Checkbox.Item
                label="Sufridas"
                status={kindFilters.includes('AFFECTED') ? 'checked' : 'unchecked'}
                onPress={() => toggleKind('AFFECTED')}
              />
            </View>

            <Text variant="titleSmall">Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Checkbox.Item
                label="Pendientes"
                status={statusFilters.includes('PENDING') ? 'checked' : 'unchecked'}
                onPress={() => toggleStatus('PENDING')}
              />
              <Checkbox.Item
                label="Aprobadas"
                status={statusFilters.includes('APPROVED') ? 'checked' : 'unchecked'}
                onPress={() => toggleStatus('APPROVED')}
              />
              <Checkbox.Item
                label="Rechazadas"
                status={statusFilters.includes('REJECTED') ? 'checked' : 'unchecked'}
                onPress={() => toggleStatus('REJECTED')}
              />
            </View>
          </Card.Content>
        </Card>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }}>
        {filteredEvents.map((event) => {
          const caster = characterById.get(event.caster_character_id);
          const targetCharacter =
            event.target_character_id !== null
              ? characterById.get(event.target_character_id)
              : null;
          const targetParty =
            event.target_party_id !== null ? partyById.get(event.target_party_id) : null;
          const skill = skillById.get(event.skill_id);
          const launchedBySelected = event.caster_character_id === selectedCharacter.id;
          const receivedByCharacter = event.target_character_id === selectedCharacter.id;
          const receivedByParty =
            selectedCharacter.party_id !== null &&
            event.target_party_id === selectedCharacter.party_id;
          const isGuildTarget =
            event.target_character_id === null &&
            event.target_party_id === null &&
            skill?.aoe === 'GUILD';
          const guildWideForSelected =
            isGuildTarget && event.guild_id === selectedCharacter.guild_id;

          let targetKind: 'character' | 'party' | 'guild' | null = null;
          let targetLabel = '';
          let targetHighlight = false;
          if (event.target_character_id !== null) {
            targetKind = 'character';
            targetLabel = targetCharacter?.name ?? `Character ${event.target_character_id}`;
            targetHighlight = receivedByCharacter;
          } else if (event.target_party_id !== null) {
            targetKind = 'party';
            targetLabel = targetParty?.name ?? `Party ${event.target_party_id}`;
            targetHighlight = receivedByParty;
          } else if (isGuildTarget) {
            targetKind = 'guild';
            targetLabel = 'Guild';
            targetHighlight = guildWideForSelected;
          }

          return (
            <Card key={event.id} mode="contained">
              <Card.Content style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="titleSmall">#{event.id}</Text>
                  <Chip compact>{event.status}</Chip>
                </View>
                <Text>
                  Skill:{' '}
                  <Text style={{ fontWeight: '700' }}>
                    {skill?.name ?? `Skill ${event.skill_id}`}
                  </Text>
                </Text>
                <Text>
                  Caster:{' '}
                  <Text
                    style={
                      launchedBySelected ? { color: '#dc2626', fontWeight: '700' } : undefined
                    }>
                    {characterOwnerLabel(caster, userById)}
                  </Text>
                </Text>
                {targetKind ? (
                  <Text>
                    {targetKind === 'character'
                      ? 'Target character: '
                      : targetKind === 'party'
                        ? 'Target party: '
                        : 'Target guild: '}
                    <Text
                      style={
                        targetHighlight ? { color: '#dc2626', fontWeight: '700' } : undefined
                      }>
                      {targetLabel}
                    </Text>
                  </Text>
                ) : null}
                {event.comment ? <Text>Comment: {event.comment}</Text> : null}
              </Card.Content>
            </Card>
          );
        })}

        {!filteredEvents.length ? <Text>No events match current filters.</Text> : null}
      </ScrollView>
    </View>
  );
}
