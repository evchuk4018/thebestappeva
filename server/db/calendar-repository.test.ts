import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createCalendarRepository } from './calendar-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  return { database, repository: createCalendarRepository(database) };
}

test('creates calendar schema tables and indexes', () => {
  const { database } = createTestRepository();
  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'calendar_%' ORDER BY name`).all() as Array<{ name: string }>;
  const indexes = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_calendar_%' ORDER BY name`).all() as Array<{ name: string }>;
  assert.deepEqual(tables.map((entry) => entry.name), [
    'calendar_calendars',
    'calendar_categories',
    'calendar_events',
    'calendar_recurrence_exceptions',
    'calendar_recurrence_rules',
    'calendar_settings',
    'calendar_task_recurrence_rules',
    'calendar_tasks',
    'calendar_undo_actions',
  ]);
  assert.ok(indexes.some((entry) => entry.name === 'idx_calendar_events_owner_range'));
  assert.ok(indexes.some((entry) => entry.name === 'idx_calendar_undo_owner_created'));
});

test('bootstraps defaults and expands recurring events', () => {
  const { repository } = createTestRepository();
  const bootstrap = repository.bootstrap();
  const calendarId = bootstrap.calendars[0].id;
  const created = repository.createEvent({
    calendarId,
    title: 'Standup',
    startsAt: '2026-06-23T13:00:00.000Z',
    endsAt: '2026-06-23T13:30:00.000Z',
    recurrence: { frequency: 'DAILY', interval: 1, count: 3 },
  });
  assert.equal(created.recurrence?.frequency, 'DAILY');
  const events = repository.listEvents('2026-06-23T00:00:00.000Z', '2026-06-28T00:00:00.000Z');
  assert.equal(events.length, 3);
  assert.equal(events[1].startsAt, '2026-06-24T13:00:00.000Z');
});

test('supports event trash, restore, hard delete, and conflict flags', () => {
  const { repository } = createTestRepository();
  const calendarId = repository.bootstrap().calendars[0].id;
  const first = repository.createEvent({ calendarId, title: 'A', startsAt: '2026-06-23T13:00:00.000Z', endsAt: '2026-06-23T14:00:00.000Z' });
  repository.createEvent({ calendarId, title: 'B', startsAt: '2026-06-23T13:30:00.000Z', endsAt: '2026-06-23T14:30:00.000Z' });
  assert.equal(repository.listEvents('2026-06-23T00:00:00.000Z', '2026-06-24T00:00:00.000Z')[0].conflict, true);
  assert.ok(repository.setEventTrash(first.id, true)?.trashedAt);
  assert.equal(repository.listEvents('2026-06-23T00:00:00.000Z', '2026-06-24T00:00:00.000Z').length, 1);
  assert.equal(repository.setEventTrash(first.id, false)?.trashedAt, null);
  assert.equal(repository.deleteEvent(first.id), true);
});

test('supports task completion and undo for updates', () => {
  const { repository } = createTestRepository();
  repository.bootstrap();
  const task = repository.createTask({ title: 'Ship calendar', dueDate: '2026-06-23', priority: 'high' });
  const completed = repository.updateTask(task.id, { title: task.title, notes: task.notes, dueDate: task.dueDate, dueAt: task.dueAt, priority: task.priority, completedAt: '2026-06-23T15:00:00.000Z' });
  assert.equal(completed?.completedAt, '2026-06-23T15:00:00.000Z');
  assert.equal(repository.undoLast(), true);
  assert.equal(repository.listTasks().find((entry) => entry.id === task.id)?.completedAt, null);
});
