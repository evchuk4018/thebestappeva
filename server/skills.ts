import type { Request, Response } from 'express';
import {
  parseCreateSkillRequest,
  parseUpdateSkillRequest,
} from '../shared/skills-contract';
import { getRequestAuthContext } from './auth/request-context';
import { createPostgresSkillsRepository } from './db/postgres-skills-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { HttpError } from './http';
import { BuiltinSkillMutationError, BuiltinSkillNameConflictError, createSkillsService } from './skills-service';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function expectBody(request: Request): Record<string, unknown> {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

function createService(request: Request) {
  return createSkillsService(createPostgresSkillsRepository(getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId)));
}

export async function handleListSkills(request: Request, response: Response) {
  sendJson(response, { skills: await createService(request).listSkillSummaries() });
}

export async function handleCreateSkill(request: Request, response: Response) {
  const parsed = parseCreateSkillRequest(expectBody(request));
  let skill;
  try {
    skill = await createService(request).createSkill(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create skill.';
    if (error instanceof BuiltinSkillNameConflictError || /UNIQUE constraint/i.test(message)) {
      throw new HttpError(409, `A skill named "${parsed.name}" already exists.`);
    }
    throw new HttpError(400, message);
  }
  sendJson(response, { skill });
}

export async function handleGetSkill(request: Request, response: Response) {
  const skill = await createService(request).getSkill(request.params.skillId);
  if (!skill) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { skill });
}

export async function handlePutSkill(request: Request, response: Response) {
  const parsed = parseUpdateSkillRequest(expectBody(request));
  let skill;
  try {
    skill = await createService(request).updateSkill(request.params.skillId, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update skill.';
    if (error instanceof BuiltinSkillMutationError) {
      throw new HttpError(400, message);
    }
    if (error instanceof BuiltinSkillNameConflictError || /UNIQUE constraint/i.test(message)) {
      throw new HttpError(409, `A skill with that name already exists.`);
    }
    throw new HttpError(400, message);
  }
  if (!skill) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { skill });
}

export async function handleDeleteSkill(request: Request, response: Response) {
  let removed;
  try {
    removed = await createService(request).deleteSkill(request.params.skillId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete skill.';
    if (error instanceof BuiltinSkillMutationError) throw new HttpError(400, message);
    throw new HttpError(400, message);
  }
  if (!removed) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { ok: true });
}

export async function handleToggleSkill(request: Request, response: Response) {
  const body = expectBody(request);
  const enabled = body.enabled;
  if (typeof enabled !== 'boolean') throw new HttpError(400, 'Body field "enabled" must be a boolean.');
  let skill;
  try {
    skill = await createService(request).setSkillEnabled(request.params.skillId, enabled);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update skill.';
    if (error instanceof BuiltinSkillMutationError) throw new HttpError(400, message);
    throw new HttpError(400, message);
  }
  if (!skill) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { skill });
}

export async function handleGetSkillByName(request: Request, response: Response) {
  const skill = await createService(request).getSkillByName(request.params.name);
  if (!skill) throw new HttpError(404, `Skill "${request.params.name}" was not found.`);
  sendJson(response, { skill });
}
