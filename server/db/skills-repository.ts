import type BetterSqlite3 from 'better-sqlite3';
import {
  CreateSkillRequest,
  SkillRecord,
  SkillSummary,
  UpdateSkillRequest,
} from '../../shared/skills-contract';
import { createSkillId } from '../../shared/skills-helpers';
import { getDatabase } from './database';

type Row = Record<string, string | number | null>;

function mapSkill(row: Row): SkillRecord {
  const metadata = JSON.parse(String(row.metadata_json ?? '{}')) as { requiredTools?: string[]; disabledTools?: string[] };
  const compatibleModesRaw = row.compatible_modes_json === null || row.compatible_modes_json === 'null'
    ? null
    : JSON.parse(String(row.compatible_modes_json)) as string[] | null;
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    instructions: String(row.instructions),
    enabled: Number(row.enabled) === 1,
    compatibleModes: compatibleModesRaw === null ? null : compatibleModesRaw as SkillRecord['compatibleModes'],
    requiredTools: Array.isArray(metadata.requiredTools) ? metadata.requiredTools : [],
    disabledTools: Array.isArray(metadata.disabledTools) ? metadata.disabledTools : [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toSummary(skill: SkillRecord): SkillSummary {
  const { instructions: _instructions, ...summary } = skill;
  return summary;
}

interface SkillRow {
  id: string;
  name: string;
  description: string;
  instructions: string;
  enabled: number;
  compatible_modes_json: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

export function createSkillsRepository(database: BetterSqlite3.Database = getDatabase()) {
  const selectSkill = database.prepare('SELECT * FROM skills WHERE id = ?');
  const selectSkillByName = database.prepare('SELECT * FROM skills WHERE name = ?');
  const listSkillsStatement = database.prepare('SELECT * FROM skills ORDER BY name ASC');
  const insertSkill = database.prepare(`
    INSERT INTO skills (id, name, description, instructions, enabled, compatible_modes_json, metadata_json, created_at, updated_at)
    VALUES (@id, @name, @description, @instructions, @enabled, @compatible_modes_json, @metadata_json, @created_at, @updated_at)
  `);
  const updateSkillStatement = database.prepare(`
    UPDATE skills
    SET name = @name,
        description = @description,
        instructions = @instructions,
        enabled = @enabled,
        compatible_modes_json = @compatible_modes_json,
        metadata_json = @metadata_json,
        updated_at = @updated_at
    WHERE id = @id
  `);
  const deleteSkillStatement = database.prepare('DELETE FROM skills WHERE id = ?');
  const setEnabledStatement = database.prepare('UPDATE skills SET enabled = ?, updated_at = ? WHERE id = ?');

  function serializeSkill(skill: SkillRecord): SkillRow {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      enabled: skill.enabled ? 1 : 0,
      compatible_modes_json: skill.compatibleModes === null ? 'null' : JSON.stringify(skill.compatibleModes),
      metadata_json: JSON.stringify({ requiredTools: skill.requiredTools, disabledTools: skill.disabledTools }),
      created_at: skill.createdAt,
      updated_at: skill.updatedAt,
    };
  }

  function getSkill(id: string): SkillRecord | null {
    const row = selectSkill.get(id) as Row | undefined;
    return row ? mapSkill(row) : null;
  }

  function getSkillByName(name: string): SkillRecord | null {
    const row = selectSkillByName.get(name) as Row | undefined;
    return row ? mapSkill(row) : null;
  }

  function listSkills(): SkillRecord[] {
    return (listSkillsStatement.all() as Row[]).map(mapSkill);
  }

  function listSkillSummaries(): SkillSummary[] {
    return listSkills().map(toSummary);
  }

  function listEnabledSkills(): SkillRecord[] {
    return listSkills().filter((skill) => skill.enabled);
  }

  function createSkill(request: CreateSkillRequest): SkillRecord {
    const id = createSkillId('skill');
    const now = new Date().toISOString();
    const skill: SkillRecord = {
      id,
      name: request.name,
      description: request.description,
      instructions: request.instructions,
      enabled: request.enabled ?? true,
      compatibleModes: request.compatibleModes ?? null,
      requiredTools: request.requiredTools ?? [],
      disabledTools: request.disabledTools ?? [],
      createdAt: now,
      updatedAt: now,
    };
    insertSkill.run(serializeSkill(skill));
    return skill;
  }

  function updateSkill(id: string, request: UpdateSkillRequest): SkillRecord | null {
    const existing = getSkill(id);
    if (!existing) return null;
    const next: SkillRecord = {
      id,
      name: request.name ?? existing.name,
      description: request.description ?? existing.description,
      instructions: request.instructions ?? existing.instructions,
      enabled: request.enabled ?? existing.enabled,
      compatibleModes: request.compatibleModes === undefined ? existing.compatibleModes : request.compatibleModes,
      requiredTools: request.requiredTools ?? existing.requiredTools,
      disabledTools: request.disabledTools ?? existing.disabledTools,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    updateSkillStatement.run(serializeSkill(next));
    return next;
  }

  function setSkillEnabled(id: string, enabled: boolean): SkillRecord | null {
    const existing = getSkill(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    setEnabledStatement.run(enabled ? 1 : 0, now, id);
    return { ...existing, enabled, updatedAt: now };
  }

  function deleteSkill(id: string): boolean {
    const result = deleteSkillStatement.run(id);
    return result.changes > 0;
  }

  return {
    getSkill,
    getSkillByName,
    listSkills,
    listSkillSummaries,
    listEnabledSkills,
    createSkill,
    updateSkill,
    setSkillEnabled,
    deleteSkill,
  };
}

export const skillsRepository = createSkillsRepository();