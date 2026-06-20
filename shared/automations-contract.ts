import {
  AUTOMATION_DATE_PATTERN,
  AUTOMATION_DESCRIPTION_MAX_LENGTH,
  AUTOMATION_NAME_MAX_LENGTH,
  AUTOMATION_PROMPT_MAX_LENGTH,
  AUTOMATION_TIME_OF_DAY_PATTERN,
} from './automations-helpers';

export type AutomationKind = 'schedule' | 'conversation';
export type AutomationCadence = 'daily' | 'weekly' | 'monthly' | 'interval';
export type AutomationIntervalUnit = 'hours' | 'days';
export type AutomationRunStatus = 'idle' | 'running' | 'success' | 'error';
export type AutomationWeekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface AutomationAction {
  prompt: string;
  linkedSkillId: string | null;
  linkedSkillName?: string | null;
  requiredTools: string[];
  disabledTools: string[];
}

export interface ScheduleTrigger {
  cadence: AutomationCadence;
  timezone: string;
  startDate: string | null;
  endDate: string | null;
  jitterMinutes: number | null;
  timeOfDay?: string;
  weekdays?: AutomationWeekday[];
  dayOfMonth?: number;
  every?: number;
  unit?: AutomationIntervalUnit;
  anchorAt?: string;
}

export interface ConversationTrigger {
  phrases: string[];
}

export interface AutomationRecord {
  id: string;
  name: string;
  description: string;
  kind: AutomationKind;
  trigger: ScheduleTrigger | ConversationTrigger;
  action: AutomationAction;
  enabled: boolean;
  nextRunAt: string | null;
  lastTriggeredAt: string | null;
  lastCompletedAt: string | null;
  lastRunStatus: AutomationRunStatus;
  lastRunSummary: string | null;
  lastError: string | null;
  lastChatId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AutomationSummary = AutomationRecord;
export type ScheduleAutomation = AutomationRecord & { kind: 'schedule'; trigger: ScheduleTrigger };
export type ConversationAutomation = AutomationRecord & { kind: 'conversation'; trigger: ConversationTrigger };

export interface CreateAutomationRequest {
  name: string;
  description: string;
  kind: AutomationKind;
  trigger: ScheduleTrigger | ConversationTrigger;
  action: AutomationAction;
  enabled?: boolean;
}

export interface UpdateAutomationRequest {
  name?: string;
  description?: string;
  kind?: AutomationKind;
  trigger?: ScheduleTrigger | ConversationTrigger;
  action?: AutomationAction;
  enabled?: boolean;
}

export interface AutomationListResponse { automations: AutomationSummary[]; }
export interface AutomationResponse { automation: AutomationRecord; }
export interface ClaimedAutomationRun { automation: AutomationRecord; claimedRunAt: string; }
export interface ClaimDueAutomationsResponse { runs: ClaimedAutomationRun[]; }
export interface ReportAutomationRunRequest {
  status: Extract<AutomationRunStatus, 'success' | 'error'>;
  summary?: string | null; error?: string | null; chatId?: string | null; completedAt?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value;
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`Invalid ${field}. Expected a string.`);
  return value;
}

function expectNullableString(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  return expectString(value, field);
}

function expectBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}. Expected a boolean.`);
  return value;
}

function expectStringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value.map((entry, index) => expectString(entry, `${field}[${index}]`));
}

function expectBoundedString(value: unknown, field: string, maxLength: number) {
  const text = expectString(value, field);
  if (!text.trim()) throw new Error(`Invalid ${field}. Must not be empty.`);
  if (text.length > maxLength) throw new Error(`Invalid ${field}. Length ${text.length} exceeds maximum ${maxLength}.`);
  return text;
}

function parseKind(value: unknown, field: string): AutomationKind {
  if (value !== 'schedule' && value !== 'conversation') {
    throw new Error(`Invalid ${field}. Expected "schedule" or "conversation".`);
  }
  return value;
}

function parseRunStatus(value: unknown, field: string): AutomationRunStatus {
  if (value !== 'idle' && value !== 'running' && value !== 'success' && value !== 'error') {
    throw new Error(`Invalid ${field}. Expected "idle", "running", "success", or "error".`);
  }
  return value;
}

function expectIsoDate(value: unknown, field: string) {
  const text = expectString(value, field);
  if (!AUTOMATION_DATE_PATTERN.test(text)) throw new Error(`Invalid ${field}. Expected YYYY-MM-DD.`);
  return text;
}

function expectIsoDateTime(value: unknown, field: string) {
  const text = expectString(value, field);
  if (Number.isNaN(Date.parse(text))) throw new Error(`Invalid ${field}. Expected an ISO timestamp.`);
  return text;
}

function expectNullableIsoDate(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  return expectIsoDate(value, field);
}

function expectNullableIsoDateTime(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  return expectIsoDateTime(value, field);
}

function expectNullableInteger(value: unknown, field: string, min: number, max: number) {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value)) throw new Error(`Invalid ${field}. Expected an integer.`);
  if ((value as number) < min || (value as number) > max) throw new Error(`Invalid ${field}. Expected ${min}-${max}.`);
  return value as number;
}

function parseAction(value: unknown, field: string): AutomationAction {
  const record = expectRecord(value, field);
  return {
    prompt: expectBoundedString(record.prompt, `${field}.prompt`, AUTOMATION_PROMPT_MAX_LENGTH),
    linkedSkillId: expectNullableString(record.linkedSkillId, `${field}.linkedSkillId`),
    linkedSkillName: record.linkedSkillName === undefined ? null : expectNullableString(record.linkedSkillName, `${field}.linkedSkillName`),
    requiredTools: record.requiredTools === undefined ? [] : expectStringArray(record.requiredTools, `${field}.requiredTools`),
    disabledTools: record.disabledTools === undefined ? [] : expectStringArray(record.disabledTools, `${field}.disabledTools`),
  };
}

function parseWeekdays(value: unknown, field: string): AutomationWeekday[] {
  const weekdays = expectStringArray(value, field);
  return weekdays.map((entry, index) => {
    if (!['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(entry)) {
      throw new Error(`Invalid ${field}[${index}]. Expected a weekday id.`);
    }
    return entry as AutomationWeekday;
  });
}

function parseScheduleTrigger(value: unknown, field: string): ScheduleTrigger {
  const record = expectRecord(value, field);
  const cadence = ['daily', 'weekly', 'monthly', 'interval'].includes(String(record.cadence))
    ? record.cadence as AutomationCadence
    : (() => { throw new Error(`Invalid ${field}.cadence.`); })();
  const trigger: ScheduleTrigger = {
    cadence,
    timezone: expectBoundedString(record.timezone, `${field}.timezone`, 100),
    startDate: expectNullableIsoDate(record.startDate, `${field}.startDate`),
    endDate: expectNullableIsoDate(record.endDate, `${field}.endDate`),
    jitterMinutes: expectNullableInteger(record.jitterMinutes, `${field}.jitterMinutes`, 0, 720),
  };
  if (cadence === 'daily') trigger.timeOfDay = parseTimeOfDay(record.timeOfDay, `${field}.timeOfDay`);
  if (cadence === 'weekly') {
    trigger.timeOfDay = parseTimeOfDay(record.timeOfDay, `${field}.timeOfDay`);
    trigger.weekdays = parseWeekdays(record.weekdays, `${field}.weekdays`);
  }
  if (cadence === 'monthly') {
    trigger.timeOfDay = parseTimeOfDay(record.timeOfDay, `${field}.timeOfDay`);
    trigger.dayOfMonth = expectNullableInteger(record.dayOfMonth, `${field}.dayOfMonth`, 1, 31) ?? 1;
  }
  if (cadence === 'interval') {
    trigger.every = expectNullableInteger(record.every, `${field}.every`, 1, 9999) ?? 1;
    if (record.unit !== 'hours' && record.unit !== 'days') throw new Error(`Invalid ${field}.unit. Expected "hours" or "days".`);
    trigger.unit = record.unit;
    trigger.anchorAt = expectIsoDateTime(record.anchorAt, `${field}.anchorAt`);
  }
  if (trigger.startDate && trigger.endDate && trigger.startDate > trigger.endDate) {
    throw new Error(`Invalid ${field}. startDate must be before or equal to endDate.`);
  }
  return trigger;
}

function parseConversationTrigger(value: unknown, field: string): ConversationTrigger {
  const record = expectRecord(value, field);
  const phrases = expectStringArray(record.phrases, `${field}.phrases`).map((entry) => entry.trim()).filter(Boolean);
  if (!phrases.length) throw new Error(`Invalid ${field}.phrases. Include at least one phrase.`);
  return { phrases };
}

function parseTimeOfDay(value: unknown, field: string) {
  const text = expectString(value, field);
  if (!AUTOMATION_TIME_OF_DAY_PATTERN.test(text)) throw new Error(`Invalid ${field}. Expected HH:MM.`);
  return text;
}

function parseTrigger(kind: AutomationKind, value: unknown, field: string) {
  return kind === 'schedule' ? parseScheduleTrigger(value, field) : parseConversationTrigger(value, field);
}

export function parseAutomation(value: unknown, field = 'Automation'): AutomationRecord {
  const record = expectRecord(value, field);
  const kind = parseKind(record.kind, `${field}.kind`);
  return {
    id: expectString(record.id, `${field}.id`),
    name: expectBoundedString(record.name, `${field}.name`, AUTOMATION_NAME_MAX_LENGTH),
    description: expectBoundedString(record.description, `${field}.description`, AUTOMATION_DESCRIPTION_MAX_LENGTH),
    kind,
    trigger: parseTrigger(kind, record.trigger, `${field}.trigger`),
    action: parseAction(record.action, `${field}.action`),
    enabled: expectBoolean(record.enabled, `${field}.enabled`),
    nextRunAt: expectNullableIsoDateTime(record.nextRunAt, `${field}.nextRunAt`),
    lastTriggeredAt: expectNullableIsoDateTime(record.lastTriggeredAt, `${field}.lastTriggeredAt`),
    lastCompletedAt: expectNullableIsoDateTime(record.lastCompletedAt, `${field}.lastCompletedAt`),
    lastRunStatus: parseRunStatus(record.lastRunStatus, `${field}.lastRunStatus`),
    lastRunSummary: expectNullableString(record.lastRunSummary, `${field}.lastRunSummary`),
    lastError: expectNullableString(record.lastError, `${field}.lastError`),
    lastChatId: expectNullableString(record.lastChatId, `${field}.lastChatId`),
    createdAt: expectIsoDateTime(record.createdAt, `${field}.createdAt`),
    updatedAt: expectIsoDateTime(record.updatedAt, `${field}.updatedAt`),
  };
}

export function parseCreateAutomationRequest(value: unknown, field = 'Create automation request'): CreateAutomationRequest {
  const record = expectRecord(value, field);
  const kind = parseKind(record.kind, `${field}.kind`);
  return {
    name: expectBoundedString(record.name, `${field}.name`, AUTOMATION_NAME_MAX_LENGTH),
    description: expectBoundedString(record.description, `${field}.description`, AUTOMATION_DESCRIPTION_MAX_LENGTH),
    kind,
    trigger: parseTrigger(kind, record.trigger, `${field}.trigger`),
    action: parseAction(record.action, `${field}.action`),
    enabled: record.enabled === undefined ? true : expectBoolean(record.enabled, `${field}.enabled`),
  };
}

export function parseUpdateAutomationRequest(value: unknown, field = 'Update automation request'): UpdateAutomationRequest {
  const record = expectRecord(value, field);
  const request: UpdateAutomationRequest = {};
  const kind = record.kind === undefined ? undefined : parseKind(record.kind, `${field}.kind`);
  if (record.name !== undefined) request.name = expectBoundedString(record.name, `${field}.name`, AUTOMATION_NAME_MAX_LENGTH);
  if (record.description !== undefined) request.description = expectBoundedString(record.description, `${field}.description`, AUTOMATION_DESCRIPTION_MAX_LENGTH);
  if (kind !== undefined) request.kind = kind;
  if (record.trigger !== undefined) request.trigger = parseTrigger(kind ?? 'schedule', record.trigger, `${field}.trigger`);
  if (record.action !== undefined) request.action = parseAction(record.action, `${field}.action`);
  if (record.enabled !== undefined) request.enabled = expectBoolean(record.enabled, `${field}.enabled`);
  return request;
}

export function parseAutomationListResponse(value: unknown, field = 'Automation list response'): AutomationListResponse {
  const record = expectRecord(value, field);
  if (!Array.isArray(record.automations)) throw new Error(`Invalid ${field}.automations. Expected an array.`);
  return { automations: record.automations.map((entry, index) => parseAutomation(entry, `${field}.automations[${index}]`)) };
}

export function parseAutomationResponse(value: unknown, field = 'Automation response'): AutomationResponse {
  const record = expectRecord(value, field);
  return { automation: parseAutomation(record.automation, `${field}.automation`) };
}

export function parseClaimDueAutomationsResponse(value: unknown, field = 'Claim automations response'): ClaimDueAutomationsResponse {
  const record = expectRecord(value, field);
  if (!Array.isArray(record.runs)) throw new Error(`Invalid ${field}.runs. Expected an array.`);
  return {
    runs: record.runs.map((entry, index) => {
      const run = expectRecord(entry, `${field}.runs[${index}]`);
      return {
        automation: parseAutomation(run.automation, `${field}.runs[${index}].automation`),
        claimedRunAt: expectIsoDateTime(run.claimedRunAt, `${field}.runs[${index}].claimedRunAt`),
      };
    }),
  };
}

export function parseReportAutomationRunRequest(value: unknown, field = 'Report automation run request'): ReportAutomationRunRequest {
  const record = expectRecord(value, field);
  const status = record.status === 'success' || record.status === 'error'
    ? record.status
    : (() => { throw new Error(`Invalid ${field}.status. Expected "success" or "error".`); })();
  return {
    status,
    summary: record.summary === undefined ? null : expectNullableString(record.summary, `${field}.summary`),
    error: record.error === undefined ? null : expectNullableString(record.error, `${field}.error`),
    chatId: record.chatId === undefined ? null : expectNullableString(record.chatId, `${field}.chatId`),
    completedAt: record.completedAt === undefined ? null : expectNullableIsoDateTime(record.completedAt, `${field}.completedAt`),
  };
}

export function isScheduleAutomation(automation: AutomationRecord): automation is ScheduleAutomation {
  return automation.kind === 'schedule';
}

export function isConversationAutomation(automation: AutomationRecord): automation is ConversationAutomation {
  return automation.kind === 'conversation';
}
