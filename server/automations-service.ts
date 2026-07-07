import type { AutomationRecord, ClaimDueAutomationsResponse, CreateAutomationRequest, ReportAutomationRunRequest, UpdateAutomationRequest } from '../shared/automations-contract';
import { normalizeAutomationName } from '../shared/automations-helpers';
import { computeLatestScheduledRunAt, computeNextScheduledRunAt } from './automations-schedule';

type MaybePromise<T> = T | Promise<T>;
export type AutomationsRepository = {
  claimDue: (nowIso: string, resolveClaim: (automation: AutomationRecord) => { claimedRunAt: string; nextRunAt: string | null }) => MaybePromise<Array<{ automation: AutomationRecord; claimedRunAt: string }>>;
  createAutomation: (request: Omit<CreateAutomationRequest, 'enabled'> & Pick<AutomationRecord, 'action' | 'enabled' | 'nextRunAt'>) => MaybePromise<AutomationRecord>;
  deleteAutomation: (id: string) => MaybePromise<boolean>;
  getAutomation: (id: string) => MaybePromise<AutomationRecord | null>;
  getAutomationByName: (name: string) => MaybePromise<AutomationRecord | null>;
  listAutomations: () => MaybePromise<AutomationRecord[]>;
  reportRun: (id: string, report: ReportAutomationRunRequest) => MaybePromise<AutomationRecord | null>;
  setAutomationEnabled: (id: string, enabled: boolean, nextRunAt: string | null) => MaybePromise<AutomationRecord | null>;
  updateAutomation: (id: string, request: UpdateAutomationRequest & Partial<Pick<AutomationRecord, 'nextRunAt'>>) => MaybePromise<AutomationRecord | null>;
};
export type SkillsLookup = {
  getSkill: (id: string) => MaybePromise<unknown>;
  getSkillByName: (name: string) => MaybePromise<unknown>;
};

export class LinkedSkillNotFoundError extends Error {}
export class AutomationNameConflictError extends Error {}

type LinkedSkill = { id: string; name: string };

function asLinkedSkill(value: unknown): LinkedSkill | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.name === 'string' ? { id: record.id, name: record.name } : null;
}

async function withValidatedLinkedSkill<T extends { action?: CreateAutomationRequest['action'] }>(record: T, lookup: SkillsLookup): Promise<T> {
  if (!record.action) return record;
  if (record.action.linkedSkillId) {
    const skill = asLinkedSkill(await lookup.getSkill(record.action.linkedSkillId));
    if (!skill) throw new LinkedSkillNotFoundError(`Linked skill "${record.action.linkedSkillId}" was not found.`);
    return { ...record, action: { ...record.action, linkedSkillId: skill.id, linkedSkillName: skill.name } };
  }
  if (record.action.linkedSkillName) {
    const skill = asLinkedSkill(await lookup.getSkillByName(record.action.linkedSkillName));
    if (!skill) throw new LinkedSkillNotFoundError(`Linked skill "${record.action.linkedSkillName}" was not found.`);
    return { ...record, action: { ...record.action, linkedSkillId: skill.id, linkedSkillName: skill.name } };
  }
  return { ...record, action: { ...record.action, linkedSkillId: null, linkedSkillName: null } };
}

function nextRunAtFor(automation: AutomationRecord) {
  return automation.kind === 'schedule' && automation.enabled ? computeNextScheduledRunAt(automation)?.toISOString() ?? null : null;
}

export function createAutomationsService(repository: AutomationsRepository, skillLookup: SkillsLookup) {
  return {
    listAutomations: () => repository.listAutomations(),
    getAutomation: (id: string) => repository.getAutomation(id),
    getAutomationByName: (name: string) => repository.getAutomationByName(normalizeAutomationName(name)),
    async createAutomation(request: CreateAutomationRequest) {
      const name = normalizeAutomationName(request.name);
      if (await repository.getAutomationByName(name)) throw new AutomationNameConflictError(`An automation named "${name}" already exists.`);
      const resolved = await withValidatedLinkedSkill({ ...request, name }, skillLookup) as CreateAutomationRequest;
      const draft: AutomationRecord = { id: 'pending', name, description: resolved.description, kind: resolved.kind, trigger: resolved.trigger, action: resolved.action, enabled: resolved.enabled ?? true, nextRunAt: null, lastTriggeredAt: null, lastCompletedAt: null, lastRunStatus: 'idle', lastRunSummary: null, lastError: null, lastChatId: null, createdAt: '', updatedAt: '' };
      return repository.createAutomation({ ...resolved, name, enabled: draft.enabled, nextRunAt: nextRunAtFor(draft) });
    },
    async updateAutomation(id: string, request: UpdateAutomationRequest) {
      const existing = await repository.getAutomation(id);
      if (!existing) return null;
      const name = request.name ? normalizeAutomationName(request.name) : existing.name;
      const duplicate = await repository.getAutomationByName(name);
      if (duplicate && duplicate.id !== id) throw new AutomationNameConflictError(`An automation named "${name}" already exists.`);
      const resolved = await withValidatedLinkedSkill(request, skillLookup) as UpdateAutomationRequest;
      const nextShape = { ...existing, ...resolved, name };
      return repository.updateAutomation(id, { ...resolved, name, nextRunAt: nextRunAtFor(nextShape) });
    },
    async setAutomationEnabled(id: string, enabled: boolean) {
      const existing = await repository.getAutomation(id);
      if (!existing) return null;
      return repository.setAutomationEnabled(id, enabled, nextRunAtFor({ ...existing, enabled }));
    },
    deleteAutomation: (id: string) => repository.deleteAutomation(id),
    async claimDue(now = new Date()): Promise<ClaimDueAutomationsResponse> {
      return {
        runs: await repository.claimDue(now.toISOString(), (automation) => ({
          claimedRunAt: computeLatestScheduledRunAt(automation, now)?.toISOString() ?? automation.nextRunAt ?? now.toISOString(),
          nextRunAt: computeNextScheduledRunAt(automation, now)?.toISOString() ?? null,
        })),
      };
    },
    reportRun: (id: string, report: ReportAutomationRunRequest) => repository.reportRun(id, report),
  };
}
