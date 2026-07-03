import type { CalendarCategory, CalendarEvent, CalendarList, CalendarRecurrence, CalendarSettings, CalendarTask } from '../../shared/calendar-contract';

export type CalendarRow = Record<string, string | number | null>;

export const defaultCalendarSettings: CalendarSettings = {
  timezone: 'America/New_York',
  weekStart: 'sun',
  hourCycle: '12',
  workingHoursStart: '09:00',
  workingHoursEnd: '17:00',
};

export function mapCalendar(row: CalendarRow): CalendarList {
  return {
    id: String(row.id),
    name: String(row.name),
    color: String(row.color),
    visible: Number(row.visible) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    trashedAt: row.trashed_at ? String(row.trashed_at) : null,
  };
}

export function mapCategory(row: CalendarRow): CalendarCategory {
  return {
    id: String(row.id),
    calendarId: String(row.calendar_id),
    name: String(row.name),
    color: String(row.color),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    trashedAt: row.trashed_at ? String(row.trashed_at) : null,
  };
}

export function mapRecurrence(row: CalendarRow): CalendarRecurrence {
  return {
    id: String(row.id),
    targetKind: String(row.target_kind) as CalendarRecurrence['targetKind'],
    targetId: String(row.target_id),
    frequency: String(row.frequency) as CalendarRecurrence['frequency'],
    interval: Number(row.interval_count),
    count: row.count_limit === null ? null : Number(row.count_limit),
    until: row.until_at ? String(row.until_at) : null,
    byWeekday: JSON.parse(String(row.by_weekday_json)) as string[],
    rruleText: String(row.rrule_text),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapEvent(row: CalendarRow, recurrence: CalendarRecurrence | null): CalendarEvent {
  return {
    id: String(row.id),
    calendarId: String(row.calendar_id),
    categoryId: row.category_id ? String(row.category_id) : null,
    title: String(row.title),
    notes: String(row.notes),
    location: String(row.location),
    timezone: String(row.timezone),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    allDay: Number(row.all_day) === 1,
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    recurrence,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    trashedAt: row.trashed_at ? String(row.trashed_at) : null,
  };
}

export function mapTask(row: CalendarRow, recurrence: CalendarRecurrence | null): CalendarTask {
  return {
    id: String(row.id),
    categoryId: row.category_id ? String(row.category_id) : null,
    title: String(row.title),
    notes: String(row.notes),
    dueAt: row.due_at ? String(row.due_at) : null,
    dueDate: row.due_date ? String(row.due_date) : null,
    timezone: String(row.timezone),
    priority: String(row.priority) as CalendarTask['priority'],
    completedAt: row.completed_at ? String(row.completed_at) : null,
    recurrence,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    trashedAt: row.trashed_at ? String(row.trashed_at) : null,
  };
}

export function mapSettings(row?: CalendarRow): CalendarSettings {
  if (!row) return defaultCalendarSettings;
  return {
    timezone: String(row.timezone),
    weekStart: String(row.week_start) as CalendarSettings['weekStart'],
    hourCycle: String(row.hour_cycle) as CalendarSettings['hourCycle'],
    workingHoursStart: String(row.working_hours_start),
    workingHoursEnd: String(row.working_hours_end),
  };
}
