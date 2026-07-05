import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { CalendarCategory, CalendarEvent, CalendarEventInput, CalendarList, CalendarRecurrence, CalendarSettings, CalendarTask, CalendarTaskInput } from '../../shared/calendar-contract';
import { expandEvent, markConflicts, recurrenceFromInput, type CalendarExceptionRow } from '../calendar-recurrence';
import { getPostgresPool } from './postgres';
import { assertOwnerUuid, normalizeJsonb, runPostgresTransaction, toIsoString, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';
import { defaultCalendarSettings } from './calendar-mappers';

type Row = Record<string, unknown>;
const colors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'];

function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function matchesText(text: string, query?: string | null) { return !query?.trim() || text.toLowerCase().includes(query.trim().toLowerCase()); }
function dateText(value: unknown) { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value); }
function optionalIso(value: unknown) { return value ? toIsoString(value) : null; }

function mapCalendar(row: Row): CalendarList {
  return { id: String(row.id), name: String(row.name), color: String(row.color), visible: Boolean(row.visible), createdAt: toIsoString(row.created_at), updatedAt: toIsoString(row.updated_at), trashedAt: optionalIso(row.trashed_at) };
}

function mapCategory(row: Row): CalendarCategory {
  return { id: String(row.id), calendarId: String(row.calendar_id), name: String(row.name), color: String(row.color), createdAt: toIsoString(row.created_at), updatedAt: toIsoString(row.updated_at), trashedAt: optionalIso(row.trashed_at) };
}

function mapRecurrence(row: Row): CalendarRecurrence {
  return { id: String(row.id), targetKind: String(row.target_kind) as CalendarRecurrence['targetKind'], targetId: String(row.target_id), frequency: String(row.frequency) as CalendarRecurrence['frequency'], interval: Number(row.interval_count), count: row.count_limit === null ? null : Number(row.count_limit), until: optionalIso(row.until_at), byWeekday: normalizeJsonb(row.by_weekday_json) as string[], rruleText: String(row.rrule_text), createdAt: toIsoString(row.created_at), updatedAt: toIsoString(row.updated_at) };
}

function mapEvent(row: Row, recurrence: CalendarRecurrence | null): CalendarEvent {
  return { id: String(row.id), calendarId: String(row.calendar_id), categoryId: row.category_id ? String(row.category_id) : null, title: String(row.title), notes: String(row.notes), location: String(row.location), timezone: String(row.timezone), startsAt: toIsoString(row.starts_at), endsAt: toIsoString(row.ends_at), allDay: Boolean(row.all_day), startDate: row.start_date ? dateText(row.start_date) : null, endDate: row.end_date ? dateText(row.end_date) : null, recurrence, createdAt: toIsoString(row.created_at), updatedAt: toIsoString(row.updated_at), trashedAt: optionalIso(row.trashed_at) };
}

function mapTask(row: Row, recurrence: CalendarRecurrence | null): CalendarTask {
  return { id: String(row.id), categoryId: row.category_id ? String(row.category_id) : null, title: String(row.title), notes: String(row.notes), dueAt: optionalIso(row.due_at), dueDate: row.due_date ? dateText(row.due_date) : null, timezone: String(row.timezone), priority: String(row.priority) as CalendarTask['priority'], completedAt: optionalIso(row.completed_at), recurrence, createdAt: toIsoString(row.created_at), updatedAt: toIsoString(row.updated_at), trashedAt: optionalIso(row.trashed_at) };
}

function mapSettings(row?: Row): CalendarSettings {
  if (!row) return defaultCalendarSettings;
  return { timezone: String(row.timezone), weekStart: String(row.week_start) as CalendarSettings['weekStart'], hourCycle: String(row.hour_cycle) as CalendarSettings['hourCycle'], workingHoursStart: String(row.working_hours_start), workingHoursEnd: String(row.working_hours_end) };
}

function eventInput(event: CalendarEvent): CalendarEventInput {
  return { calendarId: event.calendarId, categoryId: event.categoryId, title: event.title, notes: event.notes, location: event.location, timezone: event.timezone, startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay, startDate: event.startDate, endDate: event.endDate, recurrence: event.recurrence ? { frequency: event.recurrence.frequency, interval: event.recurrence.interval, count: event.recurrence.count, until: event.recurrence.until, byWeekday: event.recurrence.byWeekday } : null };
}

function taskInput(task: CalendarTask): CalendarTaskInput {
  return { categoryId: task.categoryId, title: task.title, notes: task.notes, dueAt: task.dueAt, dueDate: task.dueDate, timezone: task.timezone, priority: task.priority, completedAt: task.completedAt, recurrence: task.recurrence ? { frequency: task.recurrence.frequency, interval: task.recurrence.interval, count: task.recurrence.count, until: task.recurrence.until, byWeekday: task.recurrence.byWeekday } : null };
}

export function createPostgresCalendarRepository(ownerId: string, executor: PostgresExecutor | Pool | PoolClient = getPostgresPool()) {
  const owner = assertOwnerUuid(ownerId);
  let lastUndoCreatedAt = '';

  function nextUndoCreatedAt() {
    const current = now();
    if (current > lastUndoCreatedAt) { lastUndoCreatedAt = current; return current; }
    lastUndoCreatedAt = new Date(Date.parse(lastUndoCreatedAt) + 1).toISOString();
    return lastUndoCreatedAt;
  }

  async function recurrence(targetKind: 'event' | 'task', targetId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM calendar_recurrence_rules WHERE owner_id = $1 AND target_kind = $2 AND target_id = $3', [owner, targetKind, targetId]);
    return result.rows[0] ? mapRecurrence(result.rows[0] as Row) : null;
  }

  async function saveUndo(entityKind: string, entityId: string, actionKind: string, before: unknown, after: unknown, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    await nextExecutor.query('INSERT INTO calendar_undo_actions (owner_id, id, action_kind, entity_kind, entity_id, before_json, after_json, created_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)', [owner, id('undo'), actionKind, entityKind, entityId, before ? toJsonbParam(before) : null, after ? toJsonbParam(after) : null, nextUndoCreatedAt()]);
  }

  async function saveRecurrence(targetKind: 'event' | 'task', targetId: string, startsAt: string, input: CalendarEventInput['recurrence'], nextExecutor: PostgresExecutor) {
    await nextExecutor.query('DELETE FROM calendar_recurrence_rules WHERE owner_id = $1 AND target_kind = $2 AND target_id = $3', [owner, targetKind, targetId]);
    if (!input) return;
    const next = recurrenceFromInput(input, startsAt, now());
    await nextExecutor.query(`
      INSERT INTO calendar_recurrence_rules (owner_id, id, target_kind, target_id, frequency, interval_count, count_limit, until_at, by_weekday_json, rrule_text, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
    `, [owner, id('rrule'), targetKind, targetId, next.frequency, next.interval, next.count, next.until, toJsonbParam(next.byWeekday), next.rruleText, next.createdAt, next.updatedAt]);
  }

  async function eventById(eventId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM calendar_events WHERE owner_id = $1 AND id = $2', [owner, eventId]);
    return result.rows[0] ? mapEvent(result.rows[0] as Row, await recurrence('event', eventId, nextExecutor)) : null;
  }

  async function taskById(taskId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM calendar_tasks WHERE owner_id = $1 AND id = $2', [owner, taskId]);
    return result.rows[0] ? mapTask(result.rows[0] as Row, await recurrence('task', taskId, nextExecutor)) : null;
  }

  async function exceptionsFor(eventId: string) {
    const result = await (executor as PostgresExecutor).query('SELECT * FROM calendar_recurrence_exceptions WHERE owner_id = $1 AND event_id = $2', [owner, eventId]);
    return result.rows.map((row) => ({ id: String((row as Row).id), eventId: String((row as Row).event_id), occurrenceKey: String((row as Row).occurrence_key), action: String((row as Row).action) as CalendarExceptionRow['action'], override: (row as Row).override_json ? normalizeJsonb((row as Row).override_json) as CalendarExceptionRow['override'] : null }));
  }

  async function saveEventRow(eventId: string, input: CalendarEventInput, createdAt: string, updatedAt: string, trashedAt: string | null, nextExecutor: PostgresExecutor) {
    await nextExecutor.query(`
      INSERT INTO calendar_events (owner_id, id, calendar_id, category_id, title, notes, location, timezone, starts_at, ends_at, all_day, start_date, end_date, created_at, updated_at, trashed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (owner_id, id) DO UPDATE SET calendar_id = excluded.calendar_id, category_id = excluded.category_id, title = excluded.title, notes = excluded.notes,
        location = excluded.location, timezone = excluded.timezone, starts_at = excluded.starts_at, ends_at = excluded.ends_at, all_day = excluded.all_day,
        start_date = excluded.start_date, end_date = excluded.end_date, updated_at = excluded.updated_at, trashed_at = excluded.trashed_at
    `, [owner, eventId, input.calendarId, input.categoryId ?? null, input.title.trim(), input.notes ?? '', input.location ?? '', input.timezone ?? defaultCalendarSettings.timezone, input.startsAt, input.endsAt, Boolean(input.allDay), input.startDate ?? null, input.endDate ?? null, createdAt, updatedAt, trashedAt]);
  }

  async function saveTaskRow(taskId: string, input: CalendarTaskInput, createdAt: string, updatedAt: string, trashedAt: string | null, nextExecutor: PostgresExecutor) {
    await nextExecutor.query(`
      INSERT INTO calendar_tasks (owner_id, id, category_id, title, notes, due_at, due_date, timezone, priority, completed_at, created_at, updated_at, trashed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (owner_id, id) DO UPDATE SET category_id = excluded.category_id, title = excluded.title, notes = excluded.notes, due_at = excluded.due_at,
        due_date = excluded.due_date, timezone = excluded.timezone, priority = excluded.priority, completed_at = excluded.completed_at,
        updated_at = excluded.updated_at, trashed_at = excluded.trashed_at
    `, [owner, taskId, input.categoryId ?? null, input.title.trim(), input.notes ?? '', input.dueAt ?? null, input.dueDate ?? null, input.timezone ?? defaultCalendarSettings.timezone, input.priority ?? 'medium', input.completedAt ?? null, createdAt, updatedAt, trashedAt]);
  }

  async function listTasks(includeTrash = false) {
    const result = await (executor as PostgresExecutor).query(`SELECT * FROM calendar_tasks WHERE owner_id = $1 ${includeTrash ? '' : 'AND trashed_at IS NULL'} ORDER BY COALESCE(due_at, due_date::timestamptz, updated_at), id`, [owner]);
    const tasks = [] as CalendarTask[];
    for (const row of result.rows) tasks.push(mapTask(row as Row, await recurrence('task', String((row as Row).id))));
    return tasks;
  }

  async function updateEventInTransaction(eventId: string, input: CalendarEventInput, nextExecutor: PostgresExecutor) {
    const before = await eventById(eventId, nextExecutor);
    if (!before) return null;
    await saveEventRow(eventId, input, before.createdAt, now(), before.trashedAt, nextExecutor);
    await saveRecurrence('event', eventId, input.startsAt, input.recurrence ?? null, nextExecutor);
    const after = (await eventById(eventId, nextExecutor))!;
    await saveUndo('event', eventId, 'update', before, after, nextExecutor);
    return after;
  }

  async function updateTaskInTransaction(taskId: string, input: CalendarTaskInput, nextExecutor: PostgresExecutor) {
    const before = await taskById(taskId, nextExecutor);
    if (!before) return null;
    await saveTaskRow(taskId, input, before.createdAt, now(), before.trashedAt, nextExecutor);
    await saveRecurrence('task', taskId, input.dueAt ?? `${input.dueDate ?? before.createdAt.slice(0, 10)}T00:00:00.000Z`, input.recurrence ?? null, nextExecutor);
    const after = (await taskById(taskId, nextExecutor))!;
    await saveUndo('task', taskId, 'update', before, after, nextExecutor);
    return after;
  }

  return {
    async ensureDefaults() {
      await runPostgresTransaction(executor, async (client) => {
        const existing = await client.query('SELECT id FROM calendar_calendars WHERE owner_id = $1 LIMIT 1', [owner]);
        if (!existing.rows[0]) {
          const createdAt = now();
          const calendarId = id('cal');
          await client.query('INSERT INTO calendar_calendars (owner_id, id, name, color, visible, created_at, updated_at) VALUES ($1, $2, $3, $4, true, $5, $6)', [owner, calendarId, 'Personal', colors[0], createdAt, createdAt]);
          for (const [index, name] of ['Life', 'Work', 'Health'].entries()) await client.query('INSERT INTO calendar_categories (owner_id, id, calendar_id, name, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [owner, id('cat'), calendarId, name, colors[index + 1], createdAt, createdAt]);
        }
        const settings = await client.query('SELECT owner_id FROM calendar_settings WHERE owner_id = $1', [owner]);
        if (!settings.rows[0]) await client.query('INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [owner, defaultCalendarSettings.timezone, defaultCalendarSettings.weekStart, defaultCalendarSettings.hourCycle, defaultCalendarSettings.workingHoursStart, defaultCalendarSettings.workingHoursEnd, now()]);
      });
    },
    async bootstrap() { await this.ensureDefaults(); return { calendars: await this.listCalendars(), categories: await this.listCategories(), settings: await this.getSettings(), tasks: await listTasks() }; },
    async listCalendars(includeTrash = false) {
      const result = await (executor as PostgresExecutor).query(`SELECT * FROM calendar_calendars WHERE owner_id = $1 ${includeTrash ? '' : 'AND trashed_at IS NULL'} ORDER BY created_at, id`, [owner]);
      return result.rows.map((row) => mapCalendar(row as Row));
    },
    async listCategories(includeTrash = false) {
      const result = await (executor as PostgresExecutor).query(`SELECT * FROM calendar_categories WHERE owner_id = $1 ${includeTrash ? '' : 'AND trashed_at IS NULL'} ORDER BY name, id`, [owner]);
      return result.rows.map((row) => mapCategory(row as Row));
    },
    async createCalendar(input: Pick<CalendarList, 'name' | 'color'>) {
      const calendarId = id('cal');
      const createdAt = now();
      return runPostgresTransaction(executor, async (client) => {
        await client.query('INSERT INTO calendar_calendars (owner_id, id, name, color, visible, created_at, updated_at) VALUES ($1, $2, $3, $4, true, $5, $6)', [owner, calendarId, input.name.trim(), input.color, createdAt, createdAt]);
        const item = mapCalendar((await client.query('SELECT * FROM calendar_calendars WHERE owner_id = $1 AND id = $2', [owner, calendarId])).rows[0] as Row);
        await saveUndo('calendar', calendarId, 'create', null, item, client);
        return item;
      });
    },
    async updateCalendar(calendarId: string, input: Partial<Pick<CalendarList, 'name' | 'color' | 'visible'>>) {
      return runPostgresTransaction(executor, async (client) => {
        const beforeRow = (await client.query('SELECT * FROM calendar_calendars WHERE owner_id = $1 AND id = $2', [owner, calendarId])).rows[0] as Row | undefined;
        if (!beforeRow) return null;
        const before = mapCalendar(beforeRow);
        await client.query('UPDATE calendar_calendars SET name = $3, color = $4, visible = $5, updated_at = $6 WHERE owner_id = $1 AND id = $2', [owner, calendarId, input.name ?? before.name, input.color ?? before.color, input.visible ?? before.visible, now()]);
        const after = mapCalendar((await client.query('SELECT * FROM calendar_calendars WHERE owner_id = $1 AND id = $2', [owner, calendarId])).rows[0] as Row);
        await saveUndo('calendar', calendarId, 'update', before, after, client);
        return after;
      });
    },
    async createCategory(input: Pick<CalendarCategory, 'calendarId' | 'name' | 'color'>) {
      const categoryId = id('cat');
      const createdAt = now();
      return runPostgresTransaction(executor, async (client) => {
        await client.query('INSERT INTO calendar_categories (owner_id, id, calendar_id, name, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [owner, categoryId, input.calendarId, input.name.trim(), input.color, createdAt, createdAt]);
        const item = mapCategory((await client.query('SELECT * FROM calendar_categories WHERE owner_id = $1 AND id = $2', [owner, categoryId])).rows[0] as Row);
        await saveUndo('category', categoryId, 'create', null, item, client);
        return item;
      });
    },
    async updateCategory(categoryId: string, input: Partial<Pick<CalendarCategory, 'name' | 'color'>>) {
      return runPostgresTransaction(executor, async (client) => {
        const beforeRow = (await client.query('SELECT * FROM calendar_categories WHERE owner_id = $1 AND id = $2', [owner, categoryId])).rows[0] as Row | undefined;
        if (!beforeRow) return null;
        const before = mapCategory(beforeRow);
        await client.query('UPDATE calendar_categories SET name = $3, color = $4, updated_at = $5 WHERE owner_id = $1 AND id = $2', [owner, categoryId, input.name ?? before.name, input.color ?? before.color, now()]);
        const after = mapCategory((await client.query('SELECT * FROM calendar_categories WHERE owner_id = $1 AND id = $2', [owner, categoryId])).rows[0] as Row);
        await saveUndo('category', categoryId, 'update', before, after, client);
        return after;
      });
    },
    async listEvents(rangeStart: string, rangeEnd: string, query?: string | null, includeTrash = false) {
      const result = await (executor as PostgresExecutor).query(`SELECT * FROM calendar_events WHERE owner_id = $1 ${includeTrash ? '' : 'AND trashed_at IS NULL'} AND (starts_at < $2 OR id IN (SELECT target_id FROM calendar_recurrence_rules WHERE owner_id = $1 AND target_kind = 'event')) ORDER BY starts_at, id`, [owner, rangeEnd]);
      const occurrences: ReturnType<typeof expandEvent> = [];
      for (const row of result.rows) occurrences.push(...expandEvent(mapEvent(row as Row, await recurrence('event', String((row as Row).id))), rangeStart, rangeEnd, await exceptionsFor(String((row as Row).id))));
      return markConflicts(occurrences).filter((event) => matchesText(`${event.title} ${event.notes} ${event.location}`, query));
    },
    async createEvent(input: CalendarEventInput) {
      const eventId = id('event');
      const createdAt = now();
      return runPostgresTransaction(executor, async (client) => {
        await saveEventRow(eventId, input, createdAt, createdAt, null, client);
        await saveRecurrence('event', eventId, input.startsAt, input.recurrence ?? null, client);
        const item = (await eventById(eventId, client))!;
        await saveUndo('event', eventId, 'create', null, item, client);
        return item;
      });
    },
    async updateEvent(eventId: string, input: CalendarEventInput) { return runPostgresTransaction(executor, (client) => updateEventInTransaction(eventId, input, client)); },
    async duplicateEvent(eventId: string) { const event = await eventById(eventId); return event ? this.createEvent({ ...eventInput(event), title: `${event.title} Copy` }) : null; },
    async setEventTrash(eventId: string, trashed: boolean) {
      return runPostgresTransaction(executor, async (client) => {
        const before = await eventById(eventId, client);
        if (!before) return null;
        await client.query('UPDATE calendar_events SET trashed_at = $3, updated_at = $4 WHERE owner_id = $1 AND id = $2', [owner, eventId, trashed ? now() : null, now()]);
        const after = (await eventById(eventId, client))!;
        await saveUndo('event', eventId, trashed ? 'trash' : 'restore', before, after, client);
        return after;
      });
    },
    async deleteEvent(eventId: string) {
      return runPostgresTransaction(executor, async (client) => {
        const before = await eventById(eventId, client);
        const result = await client.query('DELETE FROM calendar_events WHERE owner_id = $1 AND id = $2', [owner, eventId]);
        if (before) await saveUndo('event', eventId, 'delete', before, null, client);
        return (result.rowCount ?? 0) > 0;
      });
    },
    async saveOccurrence(eventId: string, occurrenceKey: string, action: 'override' | 'cancel', override: Partial<CalendarEventInput> | null) {
      const createdAt = now();
      return runPostgresTransaction(executor, async (client) => {
        if (!await eventById(eventId, client)) return null;
        await client.query(`
          INSERT INTO calendar_recurrence_exceptions (owner_id, id, event_id, occurrence_key, action, override_json, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
          ON CONFLICT (owner_id, event_id, occurrence_key) DO UPDATE SET action = excluded.action, override_json = excluded.override_json, updated_at = excluded.updated_at
        `, [owner, id('ex'), eventId, occurrenceKey, action, override ? toJsonbParam(override) : null, createdAt, createdAt]);
        return eventById(eventId, client);
      });
    },
    listTasks,
    async createTask(input: CalendarTaskInput) {
      const taskId = id('task');
      const createdAt = now();
      return runPostgresTransaction(executor, async (client) => {
        await saveTaskRow(taskId, input, createdAt, createdAt, null, client);
        await saveRecurrence('task', taskId, input.dueAt ?? `${input.dueDate ?? createdAt.slice(0, 10)}T00:00:00.000Z`, input.recurrence ?? null, client);
        const item = (await taskById(taskId, client))!;
        await saveUndo('task', taskId, 'create', null, item, client);
        return item;
      });
    },
    async updateTask(taskId: string, input: CalendarTaskInput) { return runPostgresTransaction(executor, (client) => updateTaskInTransaction(taskId, input, client)); },
    async deleteTask(taskId: string) {
      return runPostgresTransaction(executor, async (client) => {
        const before = await taskById(taskId, client);
        if (!before) return false;
        await client.query('UPDATE calendar_tasks SET trashed_at = $3, updated_at = $4 WHERE owner_id = $1 AND id = $2', [owner, taskId, now(), now()]);
        await saveUndo('task', taskId, 'trash', before, await taskById(taskId, client), client);
        return true;
      });
    },
    async getSettings() { const result = await (executor as PostgresExecutor).query('SELECT * FROM calendar_settings WHERE owner_id = $1', [owner]); return mapSettings(result.rows[0] as Row | undefined); },
    async saveSettings(settings: CalendarSettings) {
      await (executor as PostgresExecutor).query('INSERT INTO calendar_settings (owner_id, timezone, week_start, hour_cycle, working_hours_start, working_hours_end, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (owner_id) DO UPDATE SET timezone = excluded.timezone, week_start = excluded.week_start, hour_cycle = excluded.hour_cycle, working_hours_start = excluded.working_hours_start, working_hours_end = excluded.working_hours_end, updated_at = excluded.updated_at', [owner, settings.timezone, settings.weekStart, settings.hourCycle, settings.workingHoursStart, settings.workingHoursEnd, now()]);
      return this.getSettings();
    },
    async undoLast() {
      return runPostgresTransaction(executor, async (client) => {
        const result = await client.query('SELECT * FROM calendar_undo_actions WHERE owner_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE', [owner]);
        const row = result.rows[0] as Row | undefined;
        if (!row) return false;
        await client.query('DELETE FROM calendar_undo_actions WHERE owner_id = $1 AND id = $2', [owner, String(row.id)]);
        const before = row.before_json ? normalizeJsonb(row.before_json) : null;
        if (row.entity_kind === 'event') {
          if (before) return Boolean(await updateEventInTransaction(String(row.entity_id), eventInput(before as CalendarEvent), client));
          const existing = await eventById(String(row.entity_id), client);
          const deleted = await client.query('DELETE FROM calendar_events WHERE owner_id = $1 AND id = $2', [owner, String(row.entity_id)]);
          if (existing) await saveUndo('event', String(row.entity_id), 'delete', existing, null, client);
          return (deleted.rowCount ?? 0) > 0;
        }
        if (row.entity_kind === 'task') {
          if (before) return Boolean(await updateTaskInTransaction(String(row.entity_id), taskInput(before as CalendarTask), client));
          const existing = await taskById(String(row.entity_id), client);
          if (!existing) return false;
          await client.query('UPDATE calendar_tasks SET trashed_at = $3, updated_at = $4 WHERE owner_id = $1 AND id = $2', [owner, String(row.entity_id), now(), now()]);
          await saveUndo('task', String(row.entity_id), 'trash', existing, await taskById(String(row.entity_id), client), client);
          return true;
        }
        return false;
      });
    },
  };
}
