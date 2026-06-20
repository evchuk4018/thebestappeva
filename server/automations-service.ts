import type { AutomationRecord, ClaimDueAutomationsResponse, CreateAutomationRequest, ReportAutomationRunRequest, UpdateAutomationRequest } from '../shared/automations-contract';
import { normalizeAutomationName } from '../shared/automations-helpers';
import { computeLatestScheduledRunAt, computeNextScheduledRunAt } from './automations-schedule';
import { automationsRepository } from './db/automations-repository';
import { skillsService } from './skills-service';

type AutomationsRepository = Pick<typeof automationsRepository, 'claimDue' | 'createAutomation' | 'deleteAutomation' | 'getAutomation' | 'getAutomationByName' | 'listAutomations' | 'reportRun' | 'setAutomationEnabled' | 'updateAutomation'>;
type SkillsLookup = Pick<typeof skillsService, 'getSkill' | 'getSkillByName'>;

export class LinkedSkillNotFoundError extends Error {}
export class AutomationNameConflictError extends Error {}

function withValidatedLinkedSkill<T extends { action?: CreateAutomationRequest['action'] }>(record: T, lookup: SkillsLookup): T {
  if (!record.action) return record;
  if (record.action.linkedSkillId) {
    const skill = lookup.getSkill(record.action.linkedSkillId);
    if (!skill) throw new LinkedSkillNotFoundError(`Linked skill "${record.action.linkedSkillId}" was not found.`);
    return { ...record, action: { ...record.action, linkedSkillId: skill.id, linkedSkillName: skill.name } };
  }
  if (record.action.linkedSkillName) {
    const skill = lookup.getSkillByName(record.action.linkedSkillName);
    if (!skill) throw new LinkedSkillNotFoundError(`Linked skill "${record.action.linkedSkillName}" was not found.`);
    return { ...record, action: { ...record.action, linkedSkillId: skill.id, linkedSkillName: skill.name } };
  }
  return { ...record, action: { ...record.action, linkedSkillId: null, linkedSkillName: null } };
}

function nextRunAtFor(automation: AutomationRecord) {
  return automation.kind === 'schedule' && automation.enabled ? computeNextScheduledRunAt(automation)?.toISOString() ?? null : null;
}

export function createAutomationsService(repository: AutomationsRepository = automationsRepository, skillLookup: SkillsLookup = skillsService) {
  return {
    listAutomations: () => repository.listAutomations(),
    getAutomation: (id: string) => repository.getAutomation(id),
    getAutomationByName: (name: string) => repository.getAutomationByName(normalizeAutomationName(name)),
    createAutomation(request: CreateAutomationRequest) {
      const name = normalizeAutomationName(request.name);
      if (repository.getAutomationByName(name)) throw new AutomationNameConflictError(`An automation named "${name}" already exists.`);
      const resolved = withValidatedLinkedSkill({ ...request, name }, skillLookup) as CreateAutomationRequest;
      const draft: AutomationRecord = { id: 'pending', name, description: resolved.description, kind: resolved.kind, trigger: resolved.trigger, action: resolved.action, enabled: resolved.enabled ?? true, nextRunAt: null, lastTriggeredAt: null, lastCompletedAt: null, lastRunStatus: 'idle', lastRunSummary: null, lastError: null, lastChatId: null, createdAt: '', updatedAt: '' };
      return repository.createAutomation({ ...resolved, name, enabled: draft.enabled, nextRunAt: nextRunAtFor(draft) });
    },
    updateAutomation(id: string, request: UpdateAutomationRequest) {
      const existing = repository.getAutomation(id);
      if (!existing) return null;
      const name = request.name ? normalizeAutomationName(request.name) : existing.name;
      const duplicate = repository.getAutomationByName(name);
      if (duplicate && duplicate.id !== id) throw new AutomationNameConflictError(`An automation named "${name}" already exists.`);
      const resolved = withValidatedLinkedSkill(request, skillLookup) as UpdateAutomationRequest;
      const nextShape = { ...existing, ...resolved, name };
      return repository.updateAutomation(id, { ...resolved, name, nextRunAt: nextRunAtFor(nextShape) });
    },
    setAutomationEnabled(id: string, enabled: boolean) {
      const existing = repository.getAutomation(id);
      if (!existing) return null;
      return repository.setAutomationEnabled(id, enabled, nextRunAtFor({ ...existing, enabled }));
    },
    deleteAutomation: (id: string) => repository.deleteAutomation(id),
    claimDue(now = new Date()): ClaimDueAutomationsResponse {
      return {
        runs: repository.claimDue(now.toISOString(), (automation) => ({
          claimedRunAt: computeLatestScheduledRunAt(automation, now)?.toISOString() ?? automation.nextRunAt ?? now.toISOString(),
          nextRunAt: computeNextScheduledRunAt(automation, now)?.toISOString() ?? null,
        })),
      };
    },
    reportRun: (id: string, report: ReportAutomationRunRequest) => repository.reportRun(id, report),
  };
}

export const automationsService = createAutomationsService();
