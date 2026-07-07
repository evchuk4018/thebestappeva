import {
  type CreateSkillRequest,
  type SkillRecord,
  toSkillSummary,
  type UpdateSkillRequest,
} from '../shared/skills-contract';
import { getBuiltinSkill, getBuiltinSkillByName, hasBuiltinSkillName, listBuiltinSkills } from './builtin-skills';

type MaybePromise<T> = T | Promise<T>;
export type SkillsRepository = {
  createSkill: (request: CreateSkillRequest) => MaybePromise<SkillRecord>;
  deleteSkill: (id: string) => MaybePromise<boolean>;
  getSkill: (id: string) => MaybePromise<SkillRecord | null>;
  getSkillByName: (name: string) => MaybePromise<SkillRecord | null>;
  listSkills: () => MaybePromise<SkillRecord[]>;
  setSkillEnabled: (id: string, enabled: boolean) => MaybePromise<SkillRecord | null>;
  updateSkill: (id: string, request: UpdateSkillRequest) => MaybePromise<SkillRecord | null>;
};

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

export function createSkillsService(repository: SkillsRepository) {
  async function listSkills() {
    return sortSkills([...listBuiltinSkills(), ...await repository.listSkills()]);
  }

  async function listSkillSummaries() {
    return (await listSkills()).map(toSkillSummary);
  }

  async function getSkill(skillId: string) {
    return getBuiltinSkill(skillId) ?? await repository.getSkill(skillId);
  }

  async function getSkillByName(name: string) {
    return getBuiltinSkillByName(name) ?? await repository.getSkillByName(name);
  }

  async function createSkill(request: CreateSkillRequest) {
    assertAvailableSkillName(request.name);
    return repository.createSkill(request);
  }

  async function updateSkill(skillId: string, request: UpdateSkillRequest) {
    assertMutableSkillId(skillId);
    if (request.name) {
      assertAvailableSkillName(request.name);
    }
    return repository.updateSkill(skillId, request);
  }

  async function updateSkillByName(skillName: string, request: UpdateSkillRequest) {
    const existing = await getSkillByName(skillName);
    if (!existing) return null;
    if (existing.readOnly) {
      throw new BuiltinSkillMutationError(`Skill "${skillName}" is built in and read-only.`);
    }
    if (request.name && request.name !== skillName) {
      assertAvailableSkillName(request.name);
    }
    return repository.updateSkill(existing.id, request);
  }

  async function setSkillEnabled(skillId: string, enabled: boolean) {
    assertMutableSkillId(skillId);
    return repository.setSkillEnabled(skillId, enabled);
  }

  async function deleteSkill(skillId: string) {
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
