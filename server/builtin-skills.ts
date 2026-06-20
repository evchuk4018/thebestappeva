import type { SkillRecord } from '../shared/skills-contract';
import { automationCreatorBuiltinSkill } from './builtin-skills/automation-creator';
import { skillCreatorBuiltinSkill } from './builtin-skills/skill-creator';

const BUILTIN_SKILLS: SkillRecord[] = [skillCreatorBuiltinSkill, automationCreatorBuiltinSkill];

export function listBuiltinSkills() {
  return BUILTIN_SKILLS;
}

export function getBuiltinSkill(id: string) {
  return BUILTIN_SKILLS.find((skill) => skill.id === id) ?? null;
}

export function getBuiltinSkillByName(name: string) {
  return BUILTIN_SKILLS.find((skill) => skill.name === name) ?? null;
}

export function hasBuiltinSkillName(name: string) {
  return BUILTIN_SKILLS.some((skill) => skill.name === name);
}
