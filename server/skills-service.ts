import {
  type CreateSkillRequest,
  type SkillRecord,
  toSkillSummary,
  type UpdateSkillRequest,
} from '../shared/skills-contract';
import { getBuiltinSkill, getBuiltinSkillByName, hasBuiltinSkillName, listBuiltinSkills } from './builtin-skills';
import { skillsRepository } from './db/skills-repository';

type SkillsRepository = Pick<typeof skillsRepository, 'createSkill' | 'deleteSkill' | 'getSkill' | 'getSkillByName' | 'listSkills' | 'setSkillEnabled' | 'updateSkill'>;

export class BuiltinSkillMutationError extends Error {}
export class BuiltinSkillNameConflictError extends Error {}

function compareSkills(a: Pick<SkillRecord, 'name' | 'source'>, b: Pick<SkillRecord, 'name' | 'source'>) {
  if (a.source !== b.source) {
    return a.source === 'builtin' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function sortSkills<T extends Pick<SkillRecord, 'name' | 'source'>>(skills: T[]) {
  return [...skills].sort(compareSkills);
}

function assertMutableSkillId(skillId: string) {
  if (getBuiltinSkill(skillId)) {
    throw new BuiltinSkillMutationError(`Skill "${skillId}" is built in and read-only.`);
  }
}

function assertAvailableSkillName(name: string) {
  if (hasBuiltinSkillName(name)) {
    throw new BuiltinSkillNameConflictError(`A skill named "${name}" already exists as a built-in skill.`);
  }
}

export function createSkillsService(repository: SkillsRepository = skillsRepository) {
  function listSkills() {
    return sortSkills([...listBuiltinSkills(), ...repository.listSkills()]);
  }

  function listSkillSummaries() {
    return listSkills().map(toSkillSummary);
  }

  function getSkill(skillId: string) {
    return getBuiltinSkill(skillId) ?? repository.getSkill(skillId);
  }

  function getSkillByName(name: string) {
    return getBuiltinSkillByName(name) ?? repository.getSkillByName(name);
  }

  function createSkill(request: CreateSkillRequest) {
    assertAvailableSkillName(request.name);
    return repository.createSkill(request);
  }

  function updateSkill(skillId: string, request: UpdateSkillRequest) {
    assertMutableSkillId(skillId);
    if (request.name) {
      assertAvailableSkillName(request.name);
    }
    return repository.updateSkill(skillId, request);
  }

  function updateSkillByName(skillName: string, request: UpdateSkillRequest) {
    const existing = getSkillByName(skillName);
    if (!existing) return null;
    if (existing.readOnly) {
      throw new BuiltinSkillMutationError(`Skill "${skillName}" is built in and read-only.`);
    }
    if (request.name && request.name !== skillName) {
      assertAvailableSkillName(request.name);
    }
    return repository.updateSkill(existing.id, request);
  }

  function setSkillEnabled(skillId: string, enabled: boolean) {
    assertMutableSkillId(skillId);
    return repository.setSkillEnabled(skillId, enabled);
  }

  function deleteSkill(skillId: string) {
    assertMutableSkillId(skillId);
    return repository.deleteSkill(skillId);
  }

  return {
    listSkills,
    listSkillSummaries,
    getSkill,
    getSkillByName,
    createSkill,
    updateSkill,
    updateSkillByName,
    setSkillEnabled,
    deleteSkill,
  };
}

export const skillsService = createSkillsService();
