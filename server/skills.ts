import type { Request, Response } from 'express';
import {
  parseCreateSkillRequest,
  parseUpdateSkillRequest,
  toSkillSummary,
} from '../shared/skills-contract';
import { HttpError } from './http';
import { skillsRepository } from './db/skills-repository';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function expectBody(request: Request): Record<string, unknown> {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

export async function handleListSkills(_request: Request, response: Response) {
  const skills = skillsRepository.listSkills().map(toSkillSummary);
  sendJson(response, { skills });
}

export async function handleCreateSkill(request: Request, response: Response) {
  const parsed = parseCreateSkillRequest(expectBody(request));
  let skill;
  try {
    skill = skillsRepository.createSkill(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create skill.';
    if (/UNIQUE constraint/i.test(message)) {
      throw new HttpError(409, `A skill named "${parsed.name}" already exists.`);
    }
    throw new HttpError(400, message);
  }
  sendJson(response, { skill });
}

export async function handleGetSkill(request: Request, response: Response) {
  const skill = skillsRepository.getSkill(request.params.skillId);
  if (!skill) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { skill });
}

export async function handlePutSkill(request: Request, response: Response) {
  const parsed = parseUpdateSkillRequest(expectBody(request));
  let skill;
  try {
    skill = skillsRepository.updateSkill(request.params.skillId, parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update skill.';
    if (/UNIQUE constraint/i.test(message)) {
      throw new HttpError(409, `A skill with that name already exists.`);
    }
    throw new HttpError(400, message);
  }
  if (!skill) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { skill });
}

export async function handleDeleteSkill(request: Request, response: Response) {
  const removed = skillsRepository.deleteSkill(request.params.skillId);
  if (!removed) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { ok: true });
}

export async function handleToggleSkill(request: Request, response: Response) {
  const body = expectBody(request);
  const enabled = body.enabled;
  if (typeof enabled !== 'boolean') throw new HttpError(400, 'Body field "enabled" must be a boolean.');
  const skill = skillsRepository.setSkillEnabled(request.params.skillId, enabled);
  if (!skill) throw new HttpError(404, `Skill "${request.params.skillId}" was not found.`);
  sendJson(response, { skill });
}

export async function handleGetSkillByName(request: Request, response: Response) {
  const skill = skillsRepository.getSkillByName(request.params.name);
  if (!skill) throw new HttpError(404, `Skill "${request.params.name}" was not found.`);
  sendJson(response, { skill });
}