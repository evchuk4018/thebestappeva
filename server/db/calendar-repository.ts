import crypto from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import type { CalendarCategory, CalendarEvent, CalendarEventInput, CalendarList, CalendarSettings, CalendarTask, CalendarTaskInput } from '../../shared/calendar-contract';
import { expandEvent, markConflicts, recurrenceFromInput, type CalendarExceptionRow } from '../calendar-recurrence';
import { getDatabase } from './database';
import { defaultCalendarSettings, localCalendarOwnerId, mapCalendar, mapCategory, mapEvent, mapRecurrence, mapSettings, mapTask, type CalendarRow } from './calendar-mappers';

const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function matchesText(text: string, query?: string | null) {
  return !query?.trim() || text.toLowerCase().includes(query.trim().toLowerCase());
}

function eventInput(event: CalendarEvent): CalendarEventInput {
  return {
    calendarId: event.calendarId,
    categoryId: event.categoryId,
    title: event.title,
    notes: event.notes,
    location: event.location,
    timezone: event.timezone,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    startDate: event.startDate,
    endDate: event.endDate,
    recurrence: event.recurrence ? {
      frequency: event.recurrence.frequency,
      interval: event.recurrence.interval,
      count: event.recurrence.count,
      until: event.recurrence.until,
      byWeekday: event.recurrence.byWeekday,
    } : null,
  };
}

function taskInput(task: CalendarTask): CalendarTaskInput {
  return {
    categoryId: task.categoryId,
    title: task.title,
    notes: task.notes,
    dueAt: task.dueAt,
    dueDate: task.dueDate,
    timezone: task.timezone,
    priority: task.priority,
    completedAt: task.completedAt,
    recurrence: task.recurrence ? {
      frequency: task.recurrence.frequency,
      interval: task.recurrence.interval,
      count: task.recurrence.count,
      until: task.recurrence.until,
      byWeekday: task.recurrence.byWeekday,
    } : null,
  };
}

export function createCalendarRepository(database: BetterSqlite3.Database = getDatabase()) {
  const owner = localCalendarOwnerId;

  function recurrence(targetKind: 'event' | 'task', targetId: string) {
    const row = database.prepare('SELECT * FROM calendar_recurrence_rules WHERE owner_id = ? AND target_kind = ? AND target_id = ?').get(owner, targetKind, targetId) as CalendarRow | undefined;
    return row ? mapRecurrence(row) : null;
  }

  function saveUndo(entityKind: string, entityId: string, actionKind: string, before: unknown, after: unknown) {
    database.prepare('INSERT INTO calendar_undo_actions (id, owner_id, action_kind, entity_kind, entity_id, before_json, after_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id('undo'), owner, actionKind, entityKind, entityId, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, now());
  }

  function saveRecurrence(targetKind: 'event' | 'task', targetId: string, startsAt: string, input: CalendarEventInput['recurrence']) {
    database.prepare('DELETE FROM calendar_recurrence_rules WHERE owner_id = ? AND target_kind = ? AND target_id = ?').run(owner, targetKind, targetId);
    if (!input) return;
    const next = recurrenceFromInput(input, startsAt, now());
    database.prepare(`
      INSERT INTO calendar_recurrence_rules (id, owner_id, target_kind, target_id, frequency, interval_count, count_limit, until_at, by_weekday_json, rrule_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id('rrule'), owner, targetKind, targetId, next.frequency, next.interval, next.count, next.until, JSON.stringify(next.byWeekday), next.rruleText, next.createdAt, next.updatedAt);
  }

  function eventById(eventId: string) {
    const row = database.prepare('SELECT * FROM calendar_events WHERE owner_id = ? AND id = ?').get(owner, eventId) as CalendarRow | undefined;
    return row ? mapEvent(row, recurrence('event', eventId)) : null;
  }

  function taskById(taskId: string) {
    const row = database.prepare('SELECT * FROM calendar_tasks WHERE owner_id = ? AND id = ?').get(owner, taskId) as CalendarRow | undefined;
    return row ? mapTask(row, recurrence('task', taskId)) : null;
  }

  function exceptionsFor(eventId: string): CalendarExceptionRow[] {
    return (database.prepare('SELECT * FROM calendar_recurrence_exceptions WHERE owner_id = ? AND event_id = ?').all(owner, eventId) as CalendarRow[]).map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id),
      occurrenceKey: String(row.occurrence_key),
      action: String(row.action) as CalendarExceptionRow['action'],
      override: row.override_json ? JSON.parse(String(row.override_json)) : null,
    }));
  }

  function saveEventRow(eventId: string, input: CalendarEventInput, createdAt: string, updatedAt: string, trashedAt: string | null) {
    database.prepare(`
      INSERT INTO calendar_events (id, owner_id, calendar_id, category_id, title, notes, location, timezone, starts_at, ends_at, all_day, start_date, end_date, created_at, updated_at, trashed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET calendar_id = excluded.calendar_id, category_id = excluded.category_id, title = excluded.title, notes = excluded.notes,
        location = excluded.location, timezone = excluded.timezone, starts_at = excluded.starts_at, ends_at = excluded.ends_at, all_day = excluded.all_day,
        start_date = excluded.start_date, end_date = excluded.end_date, updated_at = excluded.updated_at, trashed_at = excluded.trashed_at
    `).run(eventId, owner, input.calendarId, input.categoryId ?? null, input.title.trim(), input.notes ?? '', input.location ?? '', input.timezone ?? defaultCalendarSettings.timezone, input.startsAt, input.endsAt, input.allDay ? 1 : 0, input.startDate ?? null, input.endDate ?? null, createdAt, updatedAt, trashedAt);
  }

  function saveTaskRow(taskId: string, input: CalendarTaskInput, createdAt: string, updatedAt: string, trashedAt: string | null) {
    database.prepare(`
      INSERT INTO calendar_tasks (id, owner_id, category_id, title, notes, due_at, due_date, timezone, priority, completed_at, created_at, updated_at, trashed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET category_id = excluded.category_id, title = excluded.title, notes = excluded.notes, due_at = excluded.due_at,
        due_date = excluded.due_date, timezone = excluded.timezone, priority = excluded.priority, completed_at = excluded.completed_at,
        updated_at = excluded.updated_at, trashed_at = excluded.trashed_at
    `).run(taskId, owner, input.categoryId ?? null, input.title.trim(), input.notes ?? '', input.dueAt ?? null, input.dueDate ?? null, input.timezone ?? defaultCalendarSettings.timezone, input.priority ?? 'medium', input.completedAt ?? null, createdAt, updatedAt, trashedAt);
  }

  function listTasks(includeTrash = false) {
    return (database.prepare(`SELECT * FROM calendar_tasks WHERE owner_id = ? ${includeTrash ? '' : 'AND trashed_at IS NULL'} ORDER BY COALESCE(due_at, due_date, updated_at), id`).all(owner) as CalendarRow[])
      .map((row) => mapTask(row, recurrence('task', String(row.id))));
  }

  return {
    ensureDefaults() {
      if (!database.prepare('SELECT id FROM calendar_calendars WHERE owner_id = ? LIMIT 1').get(owner)) {
        const createdAt = now();
        const calendarId = id('cal');
        database.prepare('INSERT INTO calendar_calendars (id, owner_id, name, color, visible, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
          .run(calendarId, owner, 'Personal', colors[0], createdAt, createdAt);
        ['Life', 'Work', 'Health'].forEach((name, index) => {
          database.prepare('INSERT INTO calendar_categories (id, owner_id, calendar_id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id('cat'), owner, calendarId, name, colors[index + 1], createdAt, createdAt);
        });
      }
      if (!database.prepare('SELECT owner_id FROM calendar_settings WHERE owner_id = ?').get(owner)) {
        const settings = defaultCalendarSettings;
        database.prepare('INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(owner, settings.timezone, settings.weekStart, settings.hourCycle, settings.workingHoursStart, settings.workingHoursEnd, now());
      }
    },
    bootstrap() {
      this.ensureDefaults();
      return { calendars: this.listCalendars(), categories: this.listCategories(), settings: this.getSettings(), tasks: listTasks() };
    },
    listCalendars(includeTrash = false) {
      return (database.prepare(`SELECT * FROM calendar_calendars WHERE owner_id = ? ${includeTrash ? '' : 'AND trashed_at IS NULL'} ORDER BY created_at, id`).all(owner) as CalendarRow[]).map(mapCalendar);
    },
    listCategories(includeTrash = false) {
      return (database.prepare(`SELECT * FROM calendar_categories WHERE owner_id = ? ${includeTrash ? '' : 'AND trashed_at IS NULL'} ORDER BY name, id`).all(owner) as CalendarRow[]).map(mapCategory);
    },
    createCalendar(input: Pick<CalendarList, 'name' | 'color'>) {
      const createdAt = now();
      const calendarId = id('cal');
      database.prepare('INSERT INTO calendar_calendars (id, owner_id, name, color, visible, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)')
        .run(calendarId, owner, input.name.trim(), input.color, createdAt, createdAt);
      const item = this.listCalendars().find((calendar) => calendar.id === calendarId)!;
      saveUndo('calendar', calendarId, 'create', null, item);
      return item;
    },
    updateCalendar(calendarId: string, input: Partial<Pick<CalendarList, 'name' | 'color' | 'visible'>>) {
      const before = this.listCalendars(true).find((calendar) => calendar.id === calendarId);
      if (!before) return null;
      database.prepare('UPDATE calendar_calendars SET name = ?, color = ?, visible = ?, updated_at = ? WHERE owner_id = ? AND id = ?')
        .run(input.name ?? before.name, input.color ?? before.color, input.visible ?? before.visible ? 1 : 0, now(), owner, calendarId);
      const after = this.listCalendars(true).find((calendar) => calendar.id === calendarId)!;
      saveUndo('calendar', calendarId, 'update', before, after);
      return after;
    },
    createCategory(input: Pick<CalendarCategory, 'calendarId' | 'name' | 'color'>) {
      const createdAt = now();
      const categoryId = id('cat');
      database.prepare('INSERT INTO calendar_categories (id, owner_id, calendar_id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(categoryId, owner, input.calendarId, input.name.trim(), input.color, createdAt, createdAt);
      const item = this.listCategories().find((category) => category.id === categoryId)!;
      saveUndo('category', categoryId, 'create', null, item);
      return item;
    },
    updateCategory(categoryId: string, input: Partial<Pick<CalendarCategory, 'name' | 'color'>>) {
      const before = this.listCategories(true).find((category) => category.id === categoryId);
      if (!before) return null;
      database.prepare('UPDATE calendar_categories SET name = ?, color = ?, updated_at = ? WHERE owner_id = ? AND id = ?')
        .run(input.name ?? before.name, input.color ?? before.color, now(), owner, categoryId);
      const after = this.listCategories(true).find((category) => category.id === categoryId)!;
      saveUndo('category', categoryId, 'update', before, after);
      return after;
    },
    listEvents(rangeStart: string, rangeEnd: string, query?: string | null, includeTrash = false) {
      const rows = database.prepare(`SELECT * FROM calendar_events WHERE owner_id = ? ${includeTrash ? '' : 'AND trashed_at IS NULL'} AND (starts_at < ? OR id IN (SELECT target_id FROM calendar_recurrence_rules WHERE owner_id = ? AND target_kind = 'event')) ORDER BY starts_at, id`)
        .all(owner, rangeEnd, owner) as CalendarRow[];
      const occurrences = rows.flatMap((row) => expandEvent(mapEvent(row, recurrence('event', String(row.id))), rangeStart, rangeEnd, exceptionsFor(String(row.id))));
      return markConflicts(occurrences).filter((event) => matchesText(`${event.title} ${event.notes} ${event.location}`, query));
    },
    createEvent(input: CalendarEventInput) {
      const eventId = id('event');
      const createdAt = now();
      database.transaction(() => { saveEventRow(eventId, input, createdAt, createdAt, null); saveRecurrence('event', eventId, input.startsAt, input.recurrence ?? null); })();
      const item = eventById(eventId)!;
      saveUndo('event', eventId, 'create', null, item);
      return item;
    },
    updateEvent(eventId: string, input: CalendarEventInput) {
      const before = eventById(eventId);
      if (!before) return null;
      database.transaction(() => { saveEventRow(eventId, input, before.createdAt, now(), before.trashedAt); saveRecurrence('event', eventId, input.startsAt, input.recurrence ?? null); })();
      const after = eventById(eventId)!;
      saveUndo('event', eventId, 'update', before, after);
      return after;
    },
    duplicateEvent(eventId: string) {
      const event = eventById(eventId);
      if (!event) return null;
      return this.createEvent({ ...eventInput(event), title: `${event.title} Copy` });
    },
    setEventTrash(eventId: string, trashed: boolean) {
      const before = eventById(eventId);
      if (!before) return null;
      database.prepare('UPDATE calendar_events SET trashed_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?').run(trashed ? now() : null, now(), owner, eventId);
      const after = eventById(eventId)!;
      saveUndo('event', eventId, trashed ? 'trash' : 'restore', before, after);
      return after;
    },
    deleteEvent(eventId: string) {
      const before = eventById(eventId);
      database.prepare('DELETE FROM calendar_events WHERE owner_id = ? AND id = ?').run(owner, eventId);
      if (before) saveUndo('event', eventId, 'delete', before, null);
      return Boolean(before);
    },
    saveOccurrence(eventId: string, occurrenceKey: string, action: 'override' | 'cancel', override: Partial<CalendarEventInput> | null) {
      const createdAt = now();
      database.prepare(`
        INSERT INTO calendar_recurrence_exceptions (id, owner_id, event_id, occurrence_key, action, override_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_id, event_id, occurrence_key) DO UPDATE SET action = excluded.action, override_json = excluded.override_json, updated_at = excluded.updated_at
      `).run(id('ex'), owner, eventId, occurrenceKey, action, override ? JSON.stringify(override) : null, createdAt, createdAt);
      return eventById(eventId);
    },
    listTasks,
    createTask(input: CalendarTaskInput) {
      const taskId = id('task');
      const createdAt = now();
      database.transaction(() => { saveTaskRow(taskId, input, createdAt, createdAt, null); saveRecurrence('task', taskId, input.dueAt ?? `${input.dueDate ?? createdAt.slice(0, 10)}T00:00:00.000Z`, input.recurrence ?? null); })();
      const item = taskById(taskId)!;
      saveUndo('task', taskId, 'create', null, item);
      return item;
    },
    updateTask(taskId: string, input: CalendarTaskInput) {
      const before = taskById(taskId);
      if (!before) return null;
      database.transaction(() => { saveTaskRow(taskId, input, before.createdAt, now(), before.trashedAt); saveRecurrence('task', taskId, input.dueAt ?? `${input.dueDate ?? before.createdAt.slice(0, 10)}T00:00:00.000Z`, input.recurrence ?? null); })();
      const after = taskById(taskId)!;
      saveUndo('task', taskId, 'update', before, after);
      return after;
    },
    deleteTask(taskId: string) {
      const before = taskById(taskId);
      if (!before) return false;
      database.prepare('UPDATE calendar_tasks SET trashed_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?').run(now(), now(), owner, taskId);
      saveUndo('task', taskId, 'trash', before, taskById(taskId));
      return true;
    },
    getSettings() {
      return mapSettings(database.prepare('SELECT * FROM calendar_settings WHERE owner_id = ?').get(owner) as CalendarRow | undefined);
    },
    saveSettings(settings: CalendarSettings) {
      database.prepare('INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET timezone = excluded.timezone, week_start = excluded.week_start, hour_cycle = excluded.hour_cycle, working_hours_start = excluded.working_hours_start, working_hours_end = excluded.working_hours_end, updated_at = excluded.updated_at')
        .run(owner, settings.timezone, settings.weekStart, settings.hourCycle, settings.workingHoursStart, settings.workingHoursEnd, now());
      return this.getSettings();
    },
    undoLast() {
      const row = database.prepare('SELECT * FROM calendar_undo_actions WHERE owner_id = ? ORDER BY created_at DESC, id DESC LIMIT 1').get(owner) as CalendarRow | undefined;
      if (!row) return false;
      database.prepare('DELETE FROM calendar_undo_actions WHERE id = ?').run(String(row.id));
      const before = row.before_json ? JSON.parse(String(row.before_json)) : null;
      if (row.entity_kind === 'event') return before ? Boolean(this.updateEvent(String(row.entity_id), eventInput(before))) : this.deleteEvent(String(row.entity_id));
      if (row.entity_kind === 'task') return before ? Boolean(this.updateTask(String(row.entity_id), taskInput(before))) : this.deleteTask(String(row.entity_id));
      return false;
    },
  };
}

export const calendarRepository = createCalendarRepository();
