export type CharacterJob = 'Mage' | 'Rogue' | 'Paladin';
export type SkillJob = CharacterJob | 'Common' | 'Teacher';
export type SkillAoe = 'SINGLE' | 'PARTY' | 'GUILD';
export type EventStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AUTO';

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
  job: CharacterJob | null;
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
  /** True = debuff / hostile (future C5c / caps). */
  debuff: boolean;
}

export interface GameEvent {
  id: number;
  caster_character_id: number | null;
  skill_id: number;
  guild_id: number;
  target_character_id: number | null;
  target_party_id: number | null;
  status: EventStatus;
  reviewed_by_user_id: number | null;
  created_at: string;
  reviewed_at: string | null;
  comment: string | null;
}

export interface CreateEventRequest {
  caster_character_id?: number | null;
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

export function isTeacherSkill(skill: Skill) {
  return skill.job === 'Teacher';
}

export function isGrantExpSkill(skill: Skill) {
  if (!isTeacherSkill(skill)) return false;
  const name = skill.name.toLowerCase();
  return name.includes('repartir exp') || name.includes('grant exp');
}

export function isRemoveExpSkill(skill: Skill) {
  if (!isTeacherSkill(skill)) return false;
  const name = skill.name.toLowerCase();
  return name.includes('quitar exp') || name.includes('remove exp');
}

export function isTeacherExpSkill(skill: Skill) {
  return isGrantExpSkill(skill) || isRemoveExpSkill(skill);
}

export function isDebuffSkill(skill: Skill | undefined | null): boolean {
  return !!skill?.debuff;
}

export function isChangeJobSkill(skill: Skill) {
  return skill.name.toLowerCase().includes('change job');
}

export function isChooseClassSkill(skill: Skill) {
  return skill.name.toLowerCase().includes('choose class');
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

/** Destination level: 2/3/4. Supports "Level up to 2", "LEVEL UP TO LEVEL N", legacy "Level Up I/II/III". */
export function levelUpTargetLevel(skill: Skill): 2 | 3 | 4 | null {
  if (!isLevelUpSkill(skill)) return null;
  const name = skill.name.toLowerCase();
  if (name.includes('to level 4') || name.includes('to 4') || name.includes('level up iii')) return 4;
  if (name.includes('to level 3') || name.includes('to 3') || name.includes('level up ii')) return 3;
  if (name.includes('to level 2') || name.includes('to 2') || name.includes('level up i')) return 2;
  return null;
}

export function isProgressionSkill(skill: Skill) {
  return isLevelUpSkill(skill) || isChangeJobSkill(skill);
}

/** Auto-resolved events: Teacher Grant/Remove EXP, Level Up, Change Job. */
export function isAutoEventSkill(skill: Skill | undefined): boolean {
  if (!skill) return false;
  return isTeacherExpSkill(skill) || isLevelUpSkill(skill) || isChangeJobSkill(skill);
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
  const { name, detail } = guildLabelParts(guild);
  return `${name} (${detail})`;
}

/** Compact classroom-style label, e.g. "1ºA FPSuperior DAM". */
export function guildClassLabel(guild: Guild | undefined): string {
  if (!guild) return 'Unknown guild';
  const level = guild.level?.trim();
  const modality = guild.modality?.trim();
  return [`${guild.number}º${guild.letter}`, level, modality].filter(Boolean).join(' ');
}

export function guildLabelParts(guild: Guild | undefined): { name: string; detail: string } {
  if (!guild) return { name: 'Unknown guild', detail: '-' };
  const level = guild.level ?? '-';
  const modality = guild.modality ?? '-';
  return {
    name: guild.name,
    detail: `${guild.number}${guild.letter} · ${level} · ${modality}`,
  };
}

export function characterOwnerLabel(
  character: Character | undefined,
  userById: Map<number, UserPublic>
) {
  if (!character) return '-';
  const { name, owner } = characterOwnerParts(character, userById);
  return `${name} (${owner})`;
}

export function characterOwnerParts(
  character: Character | undefined,
  userById: Map<number, UserPublic>
): { name: string; owner: string } {
  if (!character) return { name: '-', owner: 'Unknown' };
  const owner = userById.get(character.user_id);
  return { name: character.name, owner: owner?.name ?? 'Unknown' };
}
