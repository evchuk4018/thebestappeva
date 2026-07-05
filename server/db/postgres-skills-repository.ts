import type { Pool, PoolClient } from 'pg';
import type { CreateSkillRequest, SkillRecord, SkillSummary, UpdateSkillRequest } from '../../shared/skills-contract';
import { createSkillId } from '../../shared/skills-helpers';
import { getPostgresPool } from './postgres';
import { asBoolean, assertOwnerUuid, normalizeJsonb, toIsoString, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

type Row = Record<string, unknown>;

function mapSkill(row: Row): SkillRecord {
  const metadata = normalizeJsonb(row.metadata_json) as { requiredTools?: string[]; disabledTools?: string[] } | null;
  const compatibleModes = normalizeJsonb(row.compatible_modes_json) as SkillRecord['compatibleModes'];
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    instructions: String(row.instructions),
    source: 'user',
    readOnly: false,
    enabled: asBoolean(row.enabled),
    compatibleModes: compatibleModes === null ? null : compatibleModes,
    requiredTools: Array.isArray(metadata?.requiredTools) ? metadata.requiredTools : [],
    disabledTools: Array.isArray(metadata?.disabledTools) ? metadata.disabledTools : [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toSummary(skill: SkillRecord): SkillSummary {
  const { instructions: _instructions, ...summary } = skill;
  return summary;
}

export function createPostgresSkillsRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
) {
  const validatedOwnerId = assertOwnerUuid(ownerId);

  async function getSkill(id: string) {
    const result = await (executor as PostgresExecutor).query('SELECT * FROM skills WHERE owner_id = $1 AND id = $2', [validatedOwnerId, id]);
    return result.rows[0] ? mapSkill(result.rows[0] as Row) : null;
  }

  async function getSkillByName(name: string) {
    const result = await (executor as PostgresExecutor).query('SELECT * FROM skills WHERE owner_id = $1 AND name = $2', [validatedOwnerId, name]);
    return result.rows[0] ? mapSkill(result.rows[0] as Row) : null;
  }

  async function listSkills() {
    const result = await (executor as PostgresExecutor).query('SELECT * FROM skills WHERE owner_id = $1 ORDER BY name ASC', [validatedOwnerId]);
    return result.rows.map((row) => mapSkill(row as Row));
  }

  return {
    getSkill,
    getSkillByName,
    listSkills,
    async listSkillSummaries() {
      return (await listSkills()).map(toSummary);
    },
    async listEnabledSkills() {
      return (await listSkills()).filter((skill) => skill.enabled);
    },
    async createSkill(request: CreateSkillRequest) {
      const now = new Date().toISOString();
      const skill: SkillRecord = {
        id: createSkillId('skill'),
        name: request.name,
        description: request.description,
        instructions: request.instructions,
        source: 'user',
        readOnly: false,
        enabled: request.enabled ?? true,
        compatibleModes: request.compatibleModes ?? null,
        requiredTools: request.requiredTools ?? [],
        disabledTools: request.disabledTools ?? [],
        createdAt: now,
        updatedAt: now,
      };
      await (executor as PostgresExecutor).query(`
        INSERT INTO skills (owner_id, id, name, description, instructions, enabled, compatible_modes_json, metadata_json, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
      `, [validatedOwnerId, skill.id, skill.name, skill.description, skill.instructions, skill.enabled, toJsonbParam(skill.compatibleModes), toJsonbParam({ requiredTools: skill.requiredTools, disabledTools: skill.disabledTools }), skill.createdAt, skill.updatedAt]);
      return skill;
    },
    async updateSkill(id: string, request: UpdateSkillRequest) {
      const existing = await getSkill(id);
      if (!existing) return null;
      const next: SkillRecord = {
        ...existing,
        name: request.name ?? existing.name,
        description: request.description ?? existing.description,
        instructions: request.instructions ?? existing.instructions,
        enabled: request.enabled ?? existing.enabled,
        compatibleModes: request.compatibleModes === undefined ? existing.compatibleModes : request.compatibleModes,
        requiredTools: request.requiredTools ?? existing.requiredTools,
        disabledTools: request.disabledTools ?? existing.disabledTools,
        updatedAt: new Date().toISOString(),
      };
      await (executor as PostgresExecutor).query(`
        UPDATE skills
        SET name = $3, description = $4, instructions = $5, enabled = $6, compatible_modes_json = $7::jsonb, metadata_json = $8::jsonb, updated_at = $9
        WHERE owner_id = $1 AND id = $2
      `, [validatedOwnerId, id, next.name, next.description, next.instructions, next.enabled, toJsonbParam(next.compatibleModes), toJsonbParam({ requiredTools: next.requiredTools, disabledTools: next.disabledTools }), next.updatedAt]);
      return next;
    },
    async setSkillEnabled(id: string, enabled: boolean) {
      const existing = await getSkill(id);
      if (!existing) return null;
      const updatedAt = new Date().toISOString();
      await (executor as PostgresExecutor).query('UPDATE skills SET enabled = $3, updated_at = $4 WHERE owner_id = $1 AND id = $2', [validatedOwnerId, id, enabled, updatedAt]);
      return { ...existing, enabled, updatedAt };
    },
    async deleteSkill(id: string) {
      const result = await (executor as PostgresExecutor).query('DELETE FROM skills WHERE owner_id = $1 AND id = $2', [validatedOwnerId, id]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
