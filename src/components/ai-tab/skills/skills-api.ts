import {
  parseCreateSkillRequest,
  parseSkillListResponse,
  parseSkillResponse,
  parseUpdateSkillRequest,
  type CreateSkillRequest,
  type SkillRecord,
  type SkillSummary,
  type UpdateSkillRequest,
} from '../../../../shared/skills-contract';
import { readJsonResponse, requestApi, requestJson } from '../../../lib/api';

export async function fetchSkills(): Promise<SkillSummary[]> {
  const payload = await requestJson('/skills');
  return parseSkillListResponse(payload).skills;
}

export async function fetchSkill(id: string): Promise<SkillRecord | null> {
  const response = await requestApi(`/skills/${id}`);
  if (response.status === 404) return null;
  return parseSkillResponse(await readJsonResponse(response)).skill;
}

export async function fetchSkillByName(name: string): Promise<SkillRecord | null> {
  const response = await requestApi(`/skills/by-name/${encodeURIComponent(name)}`);
  if (response.status === 404) return null;
  return parseSkillResponse(await readJsonResponse(response)).skill;
}

export async function createSkill(request: CreateSkillRequest): Promise<SkillRecord> {
  const validated = parseCreateSkillRequest(request);
  return parseSkillResponse(await requestJson('/skills', { method: 'POST', json: validated })).skill;
}

export async function updateSkill(id: string, request: UpdateSkillRequest): Promise<SkillRecord> {
  const validated = parseUpdateSkillRequest(request);
  return parseSkillResponse(await requestJson(`/skills/${id}`, { method: 'PUT', json: validated })).skill;
}

export async function toggleSkill(id: string, enabled: boolean): Promise<SkillRecord> {
  return parseSkillResponse(await requestJson(`/skills/${id}/toggle`, { method: 'POST', json: { enabled } })).skill;
}

export async function deleteSkill(id: string): Promise<void> {
  await requestJson(`/skills/${id}`, { method: 'DELETE' });
}
