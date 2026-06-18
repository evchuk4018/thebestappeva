export const SKILL_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MAX_LENGTH = 500;
export const SKILL_INSTRUCTIONS_MAX_LENGTH = 20000;

export function createSkillId(prefix = 'skill') {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
}