import type {
  CalendarEventInput,
  CalendarPriority,
  CalendarRecurrenceFrequency,
  CalendarRecurrenceInput,
  CalendarSettings,
  CalendarTaskInput,
  CalendarWeekStart,
} from '../../../../shared/calendar-contract';

const frequencies = new Set<CalendarRecurrenceFrequency>(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const weekdays = new Set(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

export interface ListCalendarEventsArgs {
  start: string;
  end: string;
  query: string;
  showTrash: boolean;
  recurringOnly: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function requiredString(args: Record<string, unknown>, name: string) {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`calendar requires a non-empty \`${name}\` argument.`);
  return value.trim();
}

export function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : false;
}

function iso(value: unknown, name: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || Number.isNaN(Date.parse(text))) throw new Error(`calendar requires \`${name}\` as an ISO timestamp.`);
  return text;
}

function optionalIso(value: unknown, name: string) {
  if (value === null || value === undefined || value === '') return null;
  return iso(value, name);
}

function optionalDateKey(value: unknown, name: string) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`calendar requires \`${name}\` as YYYY-MM-DD when provided.`);
  }
  return value;
}

function positiveInteger(value: unknown, name: string, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`calendar requires \`${name}\` as a positive integer.`);
  }
  return value;
}

function parseRecurrence(value: unknown): CalendarRecurrenceInput | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new Error('calendar requires `recurrence` as an object when provided.');
  if (!frequencies.has(value.frequency as CalendarRecurrenceFrequency)) {
    throw new Error('calendar recurrence frequency must be DAILY, WEEKLY, MONTHLY, or YEARLY.');
  }
  const byWeekday = Array.isArray(value.byWeekday) ? value.byWeekday.map(String) : [];
  const invalidWeekday = byWeekday.find((weekday) => !weekdays.has(weekday));
  if (invalidWeekday) throw new Error(`calendar recurrence weekday "${invalidWeekday}" is invalid.`);
  return {
    frequency: value.frequency as CalendarRecurrenceFrequency,
    interval: positiveInteger(value.interval, 'recurrence.interval'),
    count: value.count === undefined || value.count === null ? null : positiveInteger(value.count, 'recurrence.count'),
    until: optionalIso(value.until, 'recurrence.until'),
    byWeekday,
  };
}

export function parseListEventsArgs(args: Record<string, unknown>): ListCalendarEventsArgs {
  const start = iso(args.start, 'start');
  const end = iso(args.end, 'end');
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    throw new Error('calendar requires `end` to be after `start`.');
  }
  return {
    start,
    end,
    query: optionalString(args.query) ?? '',
    showTrash: optionalBoolean(args.showTrash),
    recurringOnly: optionalBoolean(args.recurringOnly),
  };
}

export function parseEventInput(args: Record<string, unknown>): CalendarEventInput {
  const startsAt = iso(args.startsAt, 'startsAt');
  const endsAt = iso(args.endsAt, 'endsAt');
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error('calendar requires `endsAt` to be after `startsAt`.');
  }
  return {
    calendarId: requiredString(args, 'calendarId'),
    categoryId: optionalString(args.categoryId) ?? null,
    title: requiredString(args, 'title'),
    notes: optionalString(args.notes) ?? '',
    location: optionalString(args.location) ?? '',
    timezone: optionalString(args.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    startsAt,
    endsAt,
    allDay: Boolean(args.allDay),
    startDate: optionalDateKey(args.startDate, 'startDate'),
    endDate: optionalDateKey(args.endDate, 'endDate'),
    recurrence: parseRecurrence(args.recurrence),
  };
}

export function parseEventOverride(value: unknown): Partial<CalendarEventInput> | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error('calendar requires `override` as an object when provided.');
  const override: Partial<CalendarEventInput> = {};
  if (value.calendarId !== undefined) override.calendarId = String(value.calendarId);
  if (value.categoryId !== undefined) override.categoryId = optionalString(value.categoryId) ?? null;
  if (value.title !== undefined) override.title = String(value.title).trim();
  if (value.notes !== undefined) override.notes = String(value.notes);
  if (value.location !== undefined) override.location = String(value.location);
  if (value.timezone !== undefined) override.timezone = String(value.timezone);
  if (value.startsAt !== undefined) override.startsAt = iso(value.startsAt, 'override.startsAt');
  if (value.endsAt !== undefined) override.endsAt = iso(value.endsAt, 'override.endsAt');
  if (value.allDay !== undefined) override.allDay = Boolean(value.allDay);
  if (value.startDate !== undefined) override.startDate = optionalDateKey(value.startDate, 'override.startDate');
  if (value.endDate !== undefined) override.endDate = optionalDateKey(value.endDate, 'override.endDate');
  return override;
}

export function parseTaskInput(args: Record<string, unknown>): CalendarTaskInput {
  const priority = args.priority === 'low' || args.priority === 'high' ? args.priority : 'medium';
  return {
    categoryId: optionalString(args.categoryId) ?? null,
    title: requiredString(args, 'title'),
    notes: optionalString(args.notes) ?? '',
    dueAt: optionalIso(args.dueAt, 'dueAt'),
    dueDate: optionalDateKey(args.dueDate, 'dueDate'),
    timezone: optionalString(args.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    priority: priority as CalendarPriority,
    completedAt: optionalIso(args.completedAt, 'completedAt'),
    recurrence: parseRecurrence(args.recurrence),
  };
}

export function parseSettings(args: Record<string, unknown>): CalendarSettings {
  const weekStart: CalendarWeekStart = args.weekStart === 'mon' ? 'mon' : 'sun';
  return {
    timezone: requiredString(args, 'timezone'),
    weekStart,
    hourCycle: args.hourCycle === '12' ? '12' : '24',
    workingHoursStart: requiredString(args, 'workingHoursStart'),
    workingHoursEnd: requiredString(args, 'workingHoursEnd'),
  };
}

