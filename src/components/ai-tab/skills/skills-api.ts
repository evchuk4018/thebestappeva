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

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({ error: 'The local server returned invalid JSON.' }));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `The local server failed with ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  return readJsonResponse(response);
}

export async function fetchSkills(): Promise<SkillSummary[]> {
  const payload = await requestJson('/api/skills');
  return parseSkillListResponse(payload).skills;
}

export async function fetchSkill(id: string): Promise<SkillRecord | null> {
  const response = await fetch(`/api/skills/${id}`);
  if (response.status === 404) return null;
  return parseSkillResponse(await readJsonResponse(response)).skill;
}

export async function fetchSkillByName(name: string): Promise<SkillRecord | null> {
  const response = await fetch(`/api/skills/by-name/${encodeURIComponent(name)}`);
  if (response.status === 404) return null;
  return parseSkillResponse(await readJsonResponse(response)).skill;
}

export async function createSkill(request: CreateSkillRequest): Promise<SkillRecord> {
  const validated = parseCreateSkillRequest(request);
  return parseSkillResponse(await requestJson('/api/skills', { method: 'POST', body: JSON.stringify(validated) })).skill;
}

export async function updateSkill(id: string, request: UpdateSkillRequest): Promise<SkillRecord> {
  const validated = parseUpdateSkillRequest(request);
  return parseSkillResponse(await requestJson(`/api/skills/${id}`, { method: 'PUT', body: JSON.stringify(validated) })).skill;
}

export async function toggleSkill(id: string, enabled: boolean): Promise<SkillRecord> {
  return parseSkillResponse(await requestJson(`/api/skills/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) })).skill;
}

export async function deleteSkill(id: string): Promise<void> {
  await requestJson(`/api/skills/${id}`, { method: 'DELETE' });
}