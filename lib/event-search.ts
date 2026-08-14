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

function statusBadgeLabel(status: EventStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'REJECTED':
      return 'Rejected';
    case 'AUTO':
      return 'Auto';
    case 'APPROVED':
      return 'Approved';
    default:
      return status;
  }
}

export type EventSearchContext = {
  skill?: Skill;
  guild?: Guild | null;
  caster?: Character;
  targetCharacter?: Character | null;
  targetParty?: Party | null;
  userById: Map<number, UserPublic>;
  reviewerName?: string | null;
};

function resolveTargetLabels(
  event: GameEvent,
  skill: Skill | undefined,
  guild: Guild | null | undefined,
  targetCharacter: Character | null | undefined,
  targetParty: Party | null | undefined,
  userById: Map<number, UserPublic>
) {
  let targetKind: 'character' | 'party' | 'guild' | null = null;
  let targetShort = '';
  let targetDisplay = '';
  let targetOwner: string | null = null;

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

  return { targetKind, targetShort, targetDisplay, targetOwner, targetPrefix };
}

export function buildEventSearchHaystack(
  event: GameEvent,
  ctx: EventSearchContext
): string {
  const { skill, guild, caster, targetCharacter, targetParty, userById, reviewerName } = ctx;
  const { targetShort, targetDisplay, targetOwner, targetPrefix, targetKind } = resolveTargetLabels(
    event,
    skill,
    guild,
    targetCharacter,
    targetParty,
    userById
  );

  const characterName =
    caster?.name ??
    (event.target_character_id != null ? targetCharacter?.name : null) ??
    null;
  const expSummary = teacherExpSummary(event, skill, reviewerName ?? null, targetShort);
  const progression = progressionSummary(event, skill, characterName);
  const skillTitle =
    skill?.name ??
    (isTeacherExpEvent(event, skill)
      ? parseExpDeltaComment(event.comment)?.startsWith('-')
        ? 'Remove EXP'
        : 'Grant EXP'
      : 'Unknown skill');

  const reviewMeta =
    (event.status === 'APPROVED' || event.status === 'REJECTED') && event.reviewed_at
      ? `Reviewed ${formatEventDate(event.reviewed_at)}${reviewerName ? ` · ${reviewerName}` : ''}`
      : null;

  const parts = [
    String(event.id),
    `#${event.id}`,
    formatEventDate(event.created_at),
    event.reviewed_at ? formatEventDate(event.reviewed_at) : '',
    event.status,
    statusBadgeLabel(event.status),
    guildClassLabel(guild ?? undefined),
    guild?.name ?? '',
    skillTitle,
    skill?.description ?? '',
    skill?.job ?? '',
    caster ? characterOwnerLabel(caster, userById) : (reviewerName ?? 'Teacher'),
    targetKind ? targetPrefix : '',
    targetDisplay,
    targetOwner ?? '',
    targetShort,
    expSummary ?? '',
    progression ?? '',
    reviewMeta ?? '',
    event.comment ?? '',
    'From',
    'Char',
    'Party',
    'Guild',
    'View comment',
    'Approve or reject',
  ];

  return parts.join(' ').toLowerCase();
}

export function eventMatchesSearch(
  query: string,
  event: GameEvent,
  ctx: EventSearchContext
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return buildEventSearchHaystack(event, ctx).includes(q);
}
