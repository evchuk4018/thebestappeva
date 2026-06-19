import { CHAT_MODES, ChatMode, isChatMode } from './chat-mode';
import {
  SKILL_DESCRIPTION_MAX_LENGTH,
  SKILL_INSTRUCTIONS_MAX_LENGTH,
  SKILL_NAME_MAX_LENGTH,
} from './skills-helpers';

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  instructions: string;
  source: SkillSource;
  readOnly: boolean;
  enabled: boolean;
  compatibleModes: ChatMode[] | null;
  requiredTools: string[];
  disabledTools: string[];
  createdAt: string;
  updatedAt: string;
}

export type SkillSource = 'builtin' | 'user';
export type SkillSummary = Omit<SkillRecord, 'instructions'>;

export interface CreateSkillRequest {
  name: string;
  description: string;
  instructions: string;
  enabled?: boolean;
  compatibleModes?: ChatMode[] | null;
  requiredTools?: string[];
  disabledTools?: string[];
}

export interface UpdateSkillRequest {
  name?: string;
  description?: string;
  instructions?: string;
  enabled?: boolean;
  compatibleModes?: ChatMode[] | null;
  requiredTools?: string[];
  disabledTools?: string[];
}

export interface SkillListResponse {
  skills: SkillSummary[];
}

export interface SkillResponse {
  skill: SkillRecord;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value;
}

function expectString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid ${field}. Expected a string.`);
  return value;
}

function expectBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}. Expected a boolean.`);
  return value;
}

function parseSkillSource(value: unknown, field: string): SkillSource {
  if (value !== 'builtin' && value !== 'user') {
    throw new Error(`Invalid ${field}. Expected "builtin" or "user".`);
  }
  return value;
}

function expectStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value.map((entry, index) => {
    if (typeof entry !== 'string') throw new Error(`Invalid ${field}[${index}]. Expected a string.`);
    return entry;
  });
}

function expectBoundedString(value: unknown, field: string, maxLength: number): string {
  const text = expectString(value, field);
  if (text.length > maxLength) {
    throw new Error(`Invalid ${field}. Length ${text.length} exceeds maximum ${maxLength}.`);
  }
  return text;
}

function parseCompatibleModes(value: unknown, field: string): ChatMode[] | null {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array or null.`);
  return value.map((entry, index) => {
    if (!isChatMode(entry)) {
      throw new Error(`Invalid ${field}[${index}]. Expected one of ${CHAT_MODES.join(' | ')}.`);
    }
    return entry;
  });
}

function parseMetadata(value: unknown, field: string): { requiredTools: string[]; disabledTools: string[] } {
  const record = expectRecord(value, field);
  return {
    requiredTools: record.requiredTools === undefined ? [] : expectStringArray(record.requiredTools, `${field}.requiredTools`),
    disabledTools: record.disabledTools === undefined ? [] : expectStringArray(record.disabledTools, `${field}.disabledTools`),
  };
}

export function toSkillSummary(skill: SkillRecord): SkillSummary {
  const { instructions: _instructions, ...summary } = skill;
  return summary;
}

export function parseSkill(value: unknown, field = 'Skill'): SkillRecord {
  const record = expectRecord(value, field);
  const metadata = record.metadata === undefined
    ? {
        requiredTools: record.requiredTools === undefined ? [] : expectStringArray(record.requiredTools, `${field}.requiredTools`),
        disabledTools: record.disabledTools === undefined ? [] : expectStringArray(record.disabledTools, `${field}.disabledTools`),
      }
    : parseMetadata(record.metadata, `${field}.metadata`);
  return {
    id: expectString(record.id, `${field}.id`),
    name: expectBoundedString(record.name, `${field}.name`, SKILL_NAME_MAX_LENGTH),
    description: expectBoundedString(record.description, `${field}.description`, SKILL_DESCRIPTION_MAX_LENGTH),
    instructions: expectBoundedString(record.instructions, `${field}.instructions`, SKILL_INSTRUCTIONS_MAX_LENGTH),
    source: parseSkillSource(record.source, `${field}.source`),
    readOnly: expectBoolean(record.readOnly, `${field}.readOnly`),
    enabled: expectBoolean(record.enabled, `${field}.enabled`),
    compatibleModes: parseCompatibleModes(record.compatibleModes, `${field}.compatibleModes`),
    requiredTools: metadata.requiredTools,
    disabledTools: metadata.disabledTools,
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
  };
}

export function parseSkillSummary(value: unknown, field = 'Skill summary'): SkillSummary {
  const record = expectRecord(value, field);
  const metadata = record.metadata === undefined
    ? {
        requiredTools: record.requiredTools === undefined ? [] : expectStringArray(record.requiredTools, `${field}.requiredTools`),
        disabledTools: record.disabledTools === undefined ? [] : expectStringArray(record.disabledTools, `${field}.disabledTools`),
      }
    : parseMetadata(record.metadata, `${field}.metadata`);
  return {
    id: expectString(record.id, `${field}.id`),
    name: expectBoundedString(record.name, `${field}.name`, SKILL_NAME_MAX_LENGTH),
    description: expectBoundedString(record.description, `${field}.description`, SKILL_DESCRIPTION_MAX_LENGTH),
    source: parseSkillSource(record.source, `${field}.source`),
    readOnly: expectBoolean(record.readOnly, `${field}.readOnly`),
    enabled: expectBoolean(record.enabled, `${field}.enabled`),
    compatibleModes: parseCompatibleModes(record.compatibleModes, `${field}.compatibleModes`),
    requiredTools: metadata.requiredTools,
    disabledTools: metadata.disabledTools,
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
  };
}

export function parseCreateSkillRequest(value: unknown, field = 'Create skill request'): CreateSkillRequest {
  const record = expectRecord(value, field);
  const name = expectBoundedString(record.name, `${field}.name`, SKILL_NAME_MAX_LENGTH);
  if (!name.trim()) throw new Error(`Invalid ${field}.name. Must not be empty.`);
  return {
    name,
    description: expectBoundedString(record.description, `${field}.description`, SKILL_DESCRIPTION_MAX_LENGTH),
    instructions: expectBoundedString(record.instructions, `${field}.instructions`, SKILL_INSTRUCTIONS_MAX_LENGTH),
    enabled: record.enabled === undefined ? true : expectBoolean(record.enabled, `${field}.enabled`),
    compatibleModes: parseCompatibleModes(record.compatibleModes, `${field}.compatibleModes`),
    requiredTools: record.requiredTools === undefined ? [] : expectStringArray(record.requiredTools, `${field}.requiredTools`),
    disabledTools: record.disabledTools === undefined ? [] : expectStringArray(record.disabledTools, `${field}.disabledTools`),
  };
}

export function parseUpdateSkillRequest(value: unknown, field = 'Update skill request'): UpdateSkillRequest {
  const record = expectRecord(value, field);
  const request: UpdateSkillRequest = {};
  if (record.name !== undefined) {
    const name = expectBoundedString(record.name, `${field}.name`, SKILL_NAME_MAX_LENGTH);
    if (!name.trim()) throw new Error(`Invalid ${field}.name. Must not be empty.`);
    request.name = name;
  }
  if (record.description !== undefined) {
    request.description = expectBoundedString(record.description, `${field}.description`, SKILL_DESCRIPTION_MAX_LENGTH);
  }
  if (record.instructions !== undefined) {
    request.instructions = expectBoundedString(record.instructions, `${field}.instructions`, SKILL_INSTRUCTIONS_MAX_LENGTH);
  }
  if (record.enabled !== undefined) {
    request.enabled = expectBoolean(record.enabled, `${field}.enabled`);
  }
  if (record.compatibleModes !== undefined) {
    request.compatibleModes = parseCompatibleModes(record.compatibleModes, `${field}.compatibleModes`);
  }
  if (record.requiredTools !== undefined) {
    request.requiredTools = expectStringArray(record.requiredTools, `${field}.requiredTools`);
  }
  if (record.disabledTools !== undefined) {
    request.disabledTools = expectStringArray(record.disabledTools, `${field}.disabledTools`);
  }
  return request;
}

export function parseSkillListResponse(value: unknown, field = 'Skill list response'): SkillListResponse {
  const record = expectRecord(value, field);
  if (!Array.isArray(record.skills)) throw new Error(`Invalid ${field}.skills. Expected an array.`);
  return { skills: record.skills.map((entry, index) => parseSkillSummary(entry, `${field}.skills[${index}]`)) };
}

export function parseSkillResponse(value: unknown, field = 'Skill response'): SkillResponse {
  const record = expectRecord(value, field);
  return { skill: parseSkill(record.skill, `${field}.skill`) };
}
