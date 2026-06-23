export type CalendarView = 'day' | 'week' | 'month' | 'year' | 'agenda';
export type CalendarWeekStart = 'sun' | 'mon';
export type CalendarHourCycle = '12' | '24';
export type CalendarPriority = 'low' | 'medium' | 'high';
export type CalendarRecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type CalendarOccurrenceAction = 'override' | 'cancel';

export interface CalendarSettings {
  timezone: string;
  weekStart: CalendarWeekStart;
  hourCycle: CalendarHourCycle;
  workingHoursStart: string;
  workingHoursEnd: string;
}

export interface CalendarList {
  id: string; name: string; color: string; visible: boolean;
  createdAt: string; updatedAt: string; trashedAt: string | null;
}

export interface CalendarCategory {
  id: string; calendarId: string; name: string; color: string;
  createdAt: string; updatedAt: string; trashedAt: string | null;
}

export interface CalendarRecurrence {
  id: string; targetKind: 'event' | 'task'; targetId: string;
  frequency: CalendarRecurrenceFrequency; interval: number;
  count: number | null; until: string | null; byWeekday: string[];
  rruleText: string; createdAt: string; updatedAt: string;
}

export interface CalendarRecurrenceInput {
  frequency: CalendarRecurrenceFrequency; interval?: number;
  count?: number | null; until?: string | null; byWeekday?: string[];
}

export interface CalendarEvent {
  id: string; calendarId: string; categoryId: string | null;
  title: string; notes: string; location: string; timezone: string;
  startsAt: string; endsAt: string; allDay: boolean;
  startDate: string | null; endDate: string | null;
  recurrence: CalendarRecurrence | null;
  createdAt: string; updatedAt: string; trashedAt: string | null;
}

export interface CalendarEventOccurrence extends CalendarEvent {
  occurrenceId: string; masterEventId: string; occurrenceKey: string;
  isRecurring: boolean; isException: boolean; conflict: boolean;
}

export interface CalendarEventInput {
  calendarId: string; categoryId?: string | null;
  title: string; notes?: string; location?: string; timezone?: string;
  startsAt: string; endsAt: string; allDay?: boolean;
  startDate?: string | null; endDate?: string | null;
  recurrence?: CalendarRecurrenceInput | null;
}

export interface CalendarTask {
  id: string; categoryId: string | null; title: string; notes: string;
  dueAt: string | null; dueDate: string | null; timezone: string;
  priority: CalendarPriority; completedAt: string | null;
  recurrence: CalendarRecurrence | null;
  createdAt: string; updatedAt: string; trashedAt: string | null;
}

export interface CalendarTaskInput {
  categoryId?: string | null; title: string; notes?: string;
  dueAt?: string | null; dueDate?: string | null; timezone?: string;
  priority?: CalendarPriority; completedAt?: string | null;
  recurrence?: CalendarRecurrenceInput | null;
}

export interface CalendarBootstrap {
  calendars: CalendarList[]; categories: CalendarCategory[];
  settings: CalendarSettings; tasks: CalendarTask[];
}

export interface CalendarEventsResponse { events: CalendarEventOccurrence[]; }
export interface CalendarEntityResponse<T> { item: T; }
export interface CalendarUndoResponse { ok: boolean; restored: boolean; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value;
}

function str(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`Invalid ${field}. Expected a string.`);
  return value;
}

function optStr(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  return str(value, field);
}

function bool(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}. Expected a boolean.`);
  return value;
}

function num(value: unknown, field: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`Invalid ${field}. Expected a number.`);
  return value;
}

function arr(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value;
}

function iso(value: unknown, field: string) {
  const text = str(value, field);
  if (Number.isNaN(Date.parse(text))) throw new Error(`Invalid ${field}. Expected an ISO timestamp.`);
  return text;
}

function dateKey(value: unknown, field: string) {
  const text = str(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`Invalid ${field}. Expected YYYY-MM-DD.`);
  return text;
}

function optIso(value: unknown, field: string) {
  if (value === null || value === undefined) return null;
  return iso(value, field);
}

function optDateKey(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null;
  return dateKey(value, field);
}

export function parseCalendarSettings(value: unknown, field = 'Calendar settings'): CalendarSettings {
  const item = record(value, field);
  return {
    timezone: str(item.timezone, `${field}.timezone`),
    weekStart: item.weekStart === 'mon' ? 'mon' : 'sun',
    hourCycle: item.hourCycle === '12' ? '12' : '24',
    workingHoursStart: str(item.workingHoursStart, `${field}.workingHoursStart`),
    workingHoursEnd: str(item.workingHoursEnd, `${field}.workingHoursEnd`),
  };
}

export function parseCalendarList(value: unknown, field = 'Calendar'): CalendarList {
  const item = record(value, field);
  return { id: str(item.id, `${field}.id`), name: str(item.name, `${field}.name`), color: str(item.color, `${field}.color`), visible: bool(item.visible, `${field}.visible`), createdAt: iso(item.createdAt, `${field}.createdAt`), updatedAt: iso(item.updatedAt, `${field}.updatedAt`), trashedAt: optIso(item.trashedAt, `${field}.trashedAt`) };
}

export function parseCalendarCategory(value: unknown, field = 'Category'): CalendarCategory {
  const item = record(value, field);
  return { id: str(item.id, `${field}.id`), calendarId: str(item.calendarId, `${field}.calendarId`), name: str(item.name, `${field}.name`), color: str(item.color, `${field}.color`), createdAt: iso(item.createdAt, `${field}.createdAt`), updatedAt: iso(item.updatedAt, `${field}.updatedAt`), trashedAt: optIso(item.trashedAt, `${field}.trashedAt`) };
}

export function parseCalendarRecurrence(value: unknown, field = 'Recurrence'): CalendarRecurrence {
  const item = record(value, field);
  return { id: str(item.id, `${field}.id`), targetKind: item.targetKind === 'task' ? 'task' : 'event', targetId: str(item.targetId, `${field}.targetId`), frequency: parseFrequency(item.frequency, `${field}.frequency`), interval: num(item.interval, `${field}.interval`), count: item.count === null ? null : num(item.count, `${field}.count`), until: optIso(item.until, `${field}.until`), byWeekday: arr(item.byWeekday, `${field}.byWeekday`).map((entry, index) => str(entry, `${field}.byWeekday[${index}]`)), rruleText: str(item.rruleText, `${field}.rruleText`), createdAt: iso(item.createdAt, `${field}.createdAt`), updatedAt: iso(item.updatedAt, `${field}.updatedAt`) };
}

function parseFrequency(value: unknown, field: string): CalendarRecurrenceFrequency {
  if (value !== 'DAILY' && value !== 'WEEKLY' && value !== 'MONTHLY' && value !== 'YEARLY') throw new Error(`Invalid ${field}.`);
  return value;
}

export function parseCalendarEventInput(value: unknown, field = 'Event input'): CalendarEventInput {
  const item = record(value, field);
  return { calendarId: str(item.calendarId, `${field}.calendarId`), categoryId: optStr(item.categoryId, `${field}.categoryId`), title: str(item.title, `${field}.title`), notes: String(item.notes ?? ''), location: String(item.location ?? ''), timezone: String(item.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), startsAt: iso(item.startsAt, `${field}.startsAt`), endsAt: iso(item.endsAt, `${field}.endsAt`), allDay: Boolean(item.allDay), startDate: optDateKey(item.startDate, `${field}.startDate`), endDate: optDateKey(item.endDate, `${field}.endDate`), recurrence: item.recurrence ? parseRecurrenceInput(item.recurrence, `${field}.recurrence`) : null };
}

export function parseRecurrenceInput(value: unknown, field = 'Recurrence input'): CalendarRecurrenceInput {
  const item = record(value, field);
  return { frequency: parseFrequency(item.frequency, `${field}.frequency`), interval: item.interval === undefined ? 1 : Math.max(1, num(item.interval, `${field}.interval`)), count: item.count === undefined ? null : item.count === null ? null : num(item.count, `${field}.count`), until: optIso(item.until, `${field}.until`), byWeekday: item.byWeekday === undefined ? [] : arr(item.byWeekday, `${field}.byWeekday`).map((entry, index) => str(entry, `${field}.byWeekday[${index}]`)) };
}

export function parseCalendarTaskInput(value: unknown, field = 'Task input'): CalendarTaskInput {
  const item = record(value, field);
  const priority = item.priority === 'high' || item.priority === 'low' ? item.priority : 'medium';
  return { categoryId: optStr(item.categoryId, `${field}.categoryId`), title: str(item.title, `${field}.title`), notes: String(item.notes ?? ''), dueAt: optIso(item.dueAt, `${field}.dueAt`), dueDate: optDateKey(item.dueDate, `${field}.dueDate`), timezone: String(item.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone), priority, completedAt: optIso(item.completedAt, `${field}.completedAt`), recurrence: item.recurrence ? parseRecurrenceInput(item.recurrence, `${field}.recurrence`) : null };
}

