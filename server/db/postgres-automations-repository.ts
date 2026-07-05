import type { Pool, PoolClient } from 'pg';
import type { AutomationRecord, CreateAutomationRequest, ReportAutomationRunRequest, UpdateAutomationRequest } from '../../shared/automations-contract';
import { createAutomationId } from '../../shared/automations-helpers';
import { getPostgresPool } from './postgres';
import { asBoolean, assertOwnerUuid, normalizeJsonb, runPostgresTransaction, toIsoString, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

type Row = Record<string, unknown>;

function mapAutomation(row: Row): AutomationRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    kind: String(row.kind) as AutomationRecord['kind'],
    trigger: normalizeJsonb(row.trigger_json) as AutomationRecord['trigger'],
    action: normalizeJsonb(row.action_json) as AutomationRecord['action'],
    enabled: asBoolean(row.enabled),
    nextRunAt: row.next_run_at ? toIsoString(row.next_run_at) : null,
    lastTriggeredAt: row.last_triggered_at ? toIsoString(row.last_triggered_at) : null,
    lastCompletedAt: row.last_completed_at ? toIsoString(row.last_completed_at) : null,
    lastRunStatus: String(row.last_run_status) as AutomationRecord['lastRunStatus'],
    lastRunSummary: row.last_run_summary ? String(row.last_run_summary) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    lastChatId: row.last_chat_id ? String(row.last_chat_id) : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function updateRunRow(executor: PostgresExecutor, ownerId: string, automation: AutomationRecord) {
  await executor.query(`
    UPDATE automations
    SET enabled = $3, next_run_at = $4, last_triggered_at = $5, last_completed_at = $6, last_run_status = $7,
        last_run_summary = $8, last_error = $9, last_chat_id = $10, updated_at = $11
    WHERE owner_id = $1 AND id = $2
  `, [ownerId, automation.id, automation.enabled, automation.nextRunAt, automation.lastTriggeredAt, automation.lastCompletedAt, automation.lastRunStatus, automation.lastRunSummary, automation.lastError, automation.lastChatId, automation.updatedAt]);
}

export function createPostgresAutomationsRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
) {
  const validatedOwnerId = assertOwnerUuid(ownerId);

  async function getAutomation(id: string) {
    const result = await (executor as PostgresExecutor).query('SELECT * FROM automations WHERE owner_id = $1 AND id = $2', [validatedOwnerId, id]);
    return result.rows[0] ? mapAutomation(result.rows[0] as Row) : null;
  }

  async function getAutomationByName(name: string) {
    const result = await (executor as PostgresExecutor).query('SELECT * FROM automations WHERE owner_id = $1 AND name = $2', [validatedOwnerId, name]);
    return result.rows[0] ? mapAutomation(result.rows[0] as Row) : null;
  }

  return {
    async listAutomations() {
      const result = await (executor as PostgresExecutor).query('SELECT * FROM automations WHERE owner_id = $1 ORDER BY updated_at DESC, id DESC', [validatedOwnerId]);
      return result.rows.map((row) => mapAutomation(row as Row));
    },
    getAutomation,
    getAutomationByName,
    async createAutomation(request: Omit<CreateAutomationRequest, 'enabled'> & Pick<AutomationRecord, 'action' | 'enabled' | 'nextRunAt'>) {
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
      await (executor as PostgresExecutor).query(`
        INSERT INTO automations (owner_id, id, name, description, kind, trigger_json, action_json, enabled, next_run_at, last_triggered_at, last_completed_at, last_run_status, last_run_summary, last_error, last_chat_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [validatedOwnerId, automation.id, automation.name, automation.description, automation.kind, toJsonbParam(automation.trigger), toJsonbParam(automation.action), automation.enabled, automation.nextRunAt, automation.lastTriggeredAt, automation.lastCompletedAt, automation.lastRunStatus, automation.lastRunSummary, automation.lastError, automation.lastChatId, automation.createdAt, automation.updatedAt]);
      return automation;
    },
    async updateAutomation(id: string, request: UpdateAutomationRequest & Partial<Pick<AutomationRecord, 'nextRunAt'>>) {
      const existing = await getAutomation(id);
      if (!existing) return null;
      const next: AutomationRecord = {
        ...existing,
        ...request,
        nextRunAt: request.nextRunAt === undefined ? existing.nextRunAt : request.nextRunAt,
        updatedAt: new Date().toISOString(),
      };
      await (executor as PostgresExecutor).query(`
        UPDATE automations
        SET name = $3, description = $4, kind = $5, trigger_json = $6::jsonb, action_json = $7::jsonb, enabled = $8, next_run_at = $9,
            last_triggered_at = $10, last_completed_at = $11, last_run_status = $12, last_run_summary = $13, last_error = $14, last_chat_id = $15, updated_at = $16
        WHERE owner_id = $1 AND id = $2
      `, [validatedOwnerId, id, next.name, next.description, next.kind, toJsonbParam(next.trigger), toJsonbParam(next.action), next.enabled, next.nextRunAt, next.lastTriggeredAt, next.lastCompletedAt, next.lastRunStatus, next.lastRunSummary, next.lastError, next.lastChatId, next.updatedAt]);
      return next;
    },
    async setAutomationEnabled(id: string, enabled: boolean, nextRunAt: string | null) {
      const existing = await getAutomation(id);
      if (!existing) return null;
      const next = { ...existing, enabled, nextRunAt, updatedAt: new Date().toISOString() };
      await (executor as PostgresExecutor).query('UPDATE automations SET enabled = $3, next_run_at = $4, updated_at = $5 WHERE owner_id = $1 AND id = $2', [validatedOwnerId, id, enabled, nextRunAt, next.updatedAt]);
      return next;
    },
    async deleteAutomation(id: string) {
      const result = await (executor as PostgresExecutor).query('DELETE FROM automations WHERE owner_id = $1 AND id = $2', [validatedOwnerId, id]);
      return (result.rowCount ?? 0) > 0;
    },
    async claimDue(nowIso: string, resolveClaim: (automation: AutomationRecord) => { claimedRunAt: string; nextRunAt: string | null }) {
      return runPostgresTransaction(executor, async (client) => {
        const due = await client.query(`
          SELECT * FROM automations
          WHERE owner_id = $1 AND kind = 'schedule' AND enabled = true AND next_run_at IS NOT NULL AND next_run_at <= $2
          ORDER BY next_run_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
        `, [validatedOwnerId, nowIso]);
        const runs = [] as Array<{ automation: AutomationRecord; claimedRunAt: string }>;
        for (const row of due.rows) {
          const automation = mapAutomation(row as Row);
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
          await updateRunRow(client, validatedOwnerId, next);
          runs.push({ automation: next, claimedRunAt: claim.claimedRunAt });
        }
        return runs;
      });
    },
    async reportRun(id: string, report: ReportAutomationRunRequest) {
      const existing = await getAutomation(id);
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
      await updateRunRow(executor as PostgresExecutor, validatedOwnerId, next);
      return next;
    },
  };
}
