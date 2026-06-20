import type BetterSqlite3 from 'better-sqlite3';
import type { AutomationRecord, CreateAutomationRequest, ReportAutomationRunRequest, UpdateAutomationRequest } from '../../shared/automations-contract';
import { createAutomationId } from '../../shared/automations-helpers';
import { getDatabase } from './database';

type Row = Record<string, string | number | null>;

function mapAutomation(row: Row): AutomationRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    kind: String(row.kind) as AutomationRecord['kind'],
    trigger: JSON.parse(String(row.trigger_json)) as AutomationRecord['trigger'],
    action: JSON.parse(String(row.action_json)) as AutomationRecord['action'],
    enabled: Number(row.enabled) === 1,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : null,
    lastTriggeredAt: row.last_triggered_at ? String(row.last_triggered_at) : null,
    lastCompletedAt: row.last_completed_at ? String(row.last_completed_at) : null,
    lastRunStatus: String(row.last_run_status) as AutomationRecord['lastRunStatus'],
    lastRunSummary: row.last_run_summary ? String(row.last_run_summary) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    lastChatId: row.last_chat_id ? String(row.last_chat_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function serializeAutomation(automation: AutomationRecord) {
  return {
    id: automation.id,
    name: automation.name,
    description: automation.description,
    kind: automation.kind,
    trigger_json: JSON.stringify(automation.trigger),
    action_json: JSON.stringify(automation.action),
    enabled: automation.enabled ? 1 : 0,
    next_run_at: automation.nextRunAt,
    last_triggered_at: automation.lastTriggeredAt,
    last_completed_at: automation.lastCompletedAt,
    last_run_status: automation.lastRunStatus,
    last_run_summary: automation.lastRunSummary,
    last_error: automation.lastError,
    last_chat_id: automation.lastChatId,
    created_at: automation.createdAt,
    updated_at: automation.updatedAt,
  };
}

export function createAutomationsRepository(database: BetterSqlite3.Database = getDatabase()) {
  const selectAll = database.prepare('SELECT * FROM automations ORDER BY updated_at DESC, id DESC');
  const selectById = database.prepare('SELECT * FROM automations WHERE id = ?');
  const selectByName = database.prepare('SELECT * FROM automations WHERE name = ?');
  const selectDue = database.prepare(`SELECT * FROM automations WHERE kind = 'schedule' AND enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ? ORDER BY next_run_at ASC, id ASC`);
  const insert = database.prepare(`
    INSERT INTO automations (id, name, description, kind, trigger_json, action_json, enabled, next_run_at, last_triggered_at, last_completed_at, last_run_status, last_run_summary, last_error, last_chat_id, created_at, updated_at)
    VALUES (@id, @name, @description, @kind, @trigger_json, @action_json, @enabled, @next_run_at, @last_triggered_at, @last_completed_at, @last_run_status, @last_run_summary, @last_error, @last_chat_id, @created_at, @updated_at)
  `);
  const update = database.prepare(`
    UPDATE automations
    SET name = @name, description = @description, kind = @kind, trigger_json = @trigger_json, action_json = @action_json, enabled = @enabled, next_run_at = @next_run_at,
        last_triggered_at = @last_triggered_at, last_completed_at = @last_completed_at, last_run_status = @last_run_status, last_run_summary = @last_run_summary,
        last_error = @last_error, last_chat_id = @last_chat_id, updated_at = @updated_at
    WHERE id = @id
  `);
  const remove = database.prepare('DELETE FROM automations WHERE id = ?');
  const updateRun = database.prepare(`
    UPDATE automations
    SET enabled = @enabled, next_run_at = @next_run_at, last_triggered_at = @last_triggered_at, last_completed_at = @last_completed_at, last_run_status = @last_run_status,
        last_run_summary = @last_run_summary, last_error = @last_error, last_chat_id = @last_chat_id, updated_at = @updated_at
    WHERE id = @id
  `);

  function getAutomation(id: string) {
    const row = selectById.get(id) as Row | undefined;
    return row ? mapAutomation(row) : null;
  }

  function getAutomationByName(name: string) {
    const row = selectByName.get(name) as Row | undefined;
    return row ? mapAutomation(row) : null;
  }

  return {
    listAutomations: () => (selectAll.all() as Row[]).map(mapAutomation),
    getAutomation,
    getAutomationByName,
    createAutomation(request: Omit<CreateAutomationRequest, 'enabled'> & Pick<AutomationRecord, 'action' | 'enabled' | 'nextRunAt'>) {
      const now = new Date().toISOString();
      const automation: AutomationRecord = {
        id: createAutomationId(),
        name: request.name,
        description: request.description,
        kind: request.kind,
        trigger: request.trigger,
        action: request.action,
        enabled: request.enabled,
        nextRunAt: request.nextRunAt,
        lastTriggeredAt: null,
        lastCompletedAt: null,
        lastRunStatus: 'idle',
        lastRunSummary: null,
        lastError: null,
        lastChatId: null,
        createdAt: now,
        updatedAt: now,
      };
      insert.run(serializeAutomation(automation));
      return automation;
    },
    updateAutomation(id: string, request: UpdateAutomationRequest & Partial<Pick<AutomationRecord, 'nextRunAt'>>) {
      const existing = getAutomation(id);
      if (!existing) return null;
      const next: AutomationRecord = {
        ...existing,
        ...request,
        nextRunAt: request.nextRunAt === undefined ? existing.nextRunAt : request.nextRunAt,
        updatedAt: new Date().toISOString(),
      };
      update.run(serializeAutomation(next));
      return next;
    },
    setAutomationEnabled(id: string, enabled: boolean, nextRunAt: string | null) {
      const existing = getAutomation(id);
      if (!existing) return null;
      const next = { ...existing, enabled, nextRunAt, updatedAt: new Date().toISOString() };
      update.run(serializeAutomation(next));
      return next;
    },
    deleteAutomation(id: string) {
      return remove.run(id).changes > 0;
    },
    claimDue(nowIso: string, resolveClaim: (automation: AutomationRecord) => { claimedRunAt: string; nextRunAt: string | null }) {
      const transaction = database.transaction(() => {
        const due = (selectDue.all(nowIso) as Row[]).map(mapAutomation);
        return due.map((automation) => {
          const claim = resolveClaim(automation);
          const next: AutomationRecord = {
            ...automation,
            nextRunAt: claim.nextRunAt,
            lastTriggeredAt: nowIso,
            lastRunStatus: 'running',
            lastRunSummary: null,
            lastError: null,
            updatedAt: nowIso,
          };
          updateRun.run(serializeAutomation(next));
          return { automation: next, claimedRunAt: claim.claimedRunAt };
        });
      });
      return transaction();
    },
    reportRun(id: string, report: ReportAutomationRunRequest) {
      const existing = getAutomation(id);
      if (!existing) return null;
      const next: AutomationRecord = {
        ...existing,
        lastCompletedAt: report.completedAt ?? new Date().toISOString(),
        lastRunStatus: report.status,
        lastRunSummary: report.summary ?? null,
        lastError: report.error ?? null,
        lastChatId: report.chatId ?? null,
        updatedAt: new Date().toISOString(),
      };
      updateRun.run(serializeAutomation(next));
      return next;
    },
  };
}

export const automationsRepository = createAutomationsRepository();
