export type CharacterJob = 'Mage' | 'Rogue' | 'Paladin';
export type SkillJob = CharacterJob | 'Common';
export type SkillAoe = 'SINGLE' | 'PARTY' | 'GUILD';
export type EventStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Guild {
  id: number;
  name: string;
  number: number;
  letter: string;
  level: string | null;
  modality: string | null;
}

export interface Party {
  id: number;
  name: string;
  guild_id: number;
}

export interface Character {
  id: number;
  name: string;
  job: CharacterJob;
  level: number;
  exp: number;
  user_id: number;
  guild_id: number;
  party_id: number | null;
}

export interface Skill {
  id: number;
  name: string;
  level_req: number;
  job: SkillJob;
  description: string;
  aoe: SkillAoe;
  exp_cost: number;
}

export interface GameEvent {
  id: number;
  caster_character_id: number;
  skill_id: number;
  guild_id: number;
  target_character_id: number | null;
  target_party_id: number | null;
  status: EventStatus;
  reviewed_by_user_id: number | null;
  created_at: string;
  comment: string | null;
}

export interface CreateEventRequest {
  caster_character_id: number;
  skill_id: number;
  guild_id: number;
  target_character_id?: number | null;
  target_party_id?: number | null;
  comment?: string | null;
}

export interface UserPublic {
  id: number;
  name: string;
  role: 'Student' | 'Teacher' | 'Admin';
}

export function isCommonSkill(skill: Skill) {
  return skill.job === 'Common';
}

export function isChangeJobSkill(skill: Skill) {
  return skill.name.toLowerCase().includes('change job');
}

export function isLevelUpSkill(skill: Skill) {
  return isCommonSkill(skill) && skill.name.toLowerCase().includes('level up');
}

/** Current level required to cast this Level Up (1/2/3). */
export function levelUpFromLevel(skill: Skill): 1 | 2 | 3 | null {
  if (!isLevelUpSkill(skill)) return null;
  const target = levelUpTargetLevel(skill);
  if (target == null) return null;
  return (target - 1) as 1 | 2 | 3;
}

/** Destination level: 2/3/4. Supports "LEVEL UP TO LEVEL N" and legacy "Level Up I/II/III". */
export function levelUpTargetLevel(skill: Skill): 2 | 3 | 4 | null {
  if (!isLevelUpSkill(skill)) return null;
  const name = skill.name.toLowerCase();
  if (name.includes('to level 4') || name.includes('level up iii')) return 4;
  if (name.includes('to level 3') || name.includes('level up ii')) return 3;
  if (name.includes('to level 2') || name.includes('level up i')) return 2;
  return null;
}

export function isProgressionSkill(skill: Skill) {
  return isLevelUpSkill(skill) || isChangeJobSkill(skill);
}

/** Hide obsolete Level Ups; Change Job always listed under Lvl 3 (locked until level 3 in UI). */
export function shouldShowSkillForCharacter(skill: Skill, characterLevel: number) {
  const from = levelUpFromLevel(skill);
  if (from !== null) return characterLevel === from;
  if (isChangeJobSkill(skill)) return true;
  return true;
}

export function skillListSection(skill: Skill): number {
  const from = levelUpFromLevel(skill);
  if (from !== null) return from;
  if (isChangeJobSkill(skill)) return 3;
  return Math.min(4, Math.max(1, skill.level_req || 1));
}

export function guildLabel(guild: Guild | undefined) {
  if (!guild) return 'Unknown guild';
  return `${guild.number}. ${guild.name} (${guild.number} ${guild.letter} ${guild.level ?? '-'} ${guild.modality ?? '-'})`;
}

export function characterOwnerLabel(
  character: Character | undefined,
  userById: Map<number, UserPublic>
) {
  if (!character) return '-';
  const owner = userById.get(character.user_id);
  return `${character.id}. ${character.name} (${owner?.name ?? `User ${character.user_id}`})`;
}
