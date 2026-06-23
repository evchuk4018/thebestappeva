import assert from 'node:assert/strict';
import test from 'node:test';
import { calendarTool } from './calendar-tool';
import { getToolRegistryEntries } from './registry';

function invocation(functionName: string, args: Record<string, unknown> = {}) {
  return { toolId: 'calendar', functionName, args, createdAt: '2026-06-23T00:00:00.000Z' };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

function withMockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => handler(String(input), init);
  return () => { globalThis.fetch = original; };
}

async function run(functionName: string, args: Record<string, unknown> = {}) {
  const result = await calendarTool.execute(invocation(functionName, args), {});
  assert.equal('deferred' in result, false);
  if ('deferred' in result) throw new Error('calendar tool should not defer');
  return result;
}

const event = {
  id: 'event-1',
  masterEventId: 'event-1',
  occurrenceKey: '2026-06-23T13:00:00.000Z',
  occurrenceId: 'event-1:2026-06-23T13:00:00.000Z',
  title: 'Lecture',
  isRecurring: true,
};

test('calendar tool is registered and enabled by default', () => {
  const entry = getToolRegistryEntries().find((candidate) => candidate.definition.id === 'calendar');
  assert.equal(entry?.definition.alias, '/calendar');
  assert.equal(entry?.definition.enabledByDefault, true);
});

test('get_calendar_overview loads calendars, categories, settings, and tasks', async () => {
  const restore = withMockFetch((url) => {
    assert.equal(url, '/api/calendar/bootstrap');
    return json({
      calendars: [{ id: 'cal-1', name: 'Personal' }],
      categories: [{ id: 'cat-1', calendarId: 'cal-1', name: 'School' }],
      settings: { timezone: 'America/New_York', weekStart: 'sun', hourCycle: '12', workingHoursStart: '09:00', workingHoursEnd: '17:00' },
      tasks: [{ id: 'task-1', title: 'Read chapter' }],
    });
  });
  try {
    const result = await run('get_calendar_overview');
    assert.equal(result.ok, true);
    assert.equal((result.data?.calendars as unknown[]).length, 1);
  } finally {
    restore();
  }
});

test('list_calendar_events supports ranges and recurring-only filtering', async () => {
  const restore = withMockFetch((url) => {
    assert.match(url, /^\/api\/calendar\/events\?/);
    assert.match(url, /start=2026-06-23T00%3A00%3A00.000Z/);
    return json({ events: [event, { ...event, id: 'event-2', isRecurring: false }] });
  });
  try {
    const result = await run('list_calendar_events', {
      start: '2026-06-23T00:00:00.000Z',
      end: '2026-06-30T00:00:00.000Z',
      query: 'lecture',
      recurringOnly: true,
    });
    assert.equal(result.ok, true);
    assert.equal((result.data?.events as unknown[]).length, 1);
  } finally {
    restore();
  }
});

test('create_calendar_event writes timed recurring and all-day events', async () => {
  const bodies: Array<Record<string, unknown>> = [];
  const restore = withMockFetch((_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return json({ item: { id: `event-${bodies.length}`, title: bodies.at(-1)?.title } });
  });
  try {
    await run('create_calendar_event', {
      calendarId: 'cal-1',
      title: 'CS 101',
      startsAt: '2026-06-23T13:00:00.000Z',
      endsAt: '2026-06-23T14:15:00.000Z',
      recurrence: { frequency: 'WEEKLY', interval: 1, byWeekday: ['TU', 'TH'] },
    });
    await run('create_calendar_event', {
      calendarId: 'cal-1',
      title: 'Project due',
      startsAt: '2026-07-01T04:00:00.000Z',
      endsAt: '2026-07-02T04:00:00.000Z',
      allDay: true,
      startDate: '2026-07-01',
      endDate: '2026-07-01',
    });
    assert.equal(bodies[0].recurrence && (bodies[0].recurrence as Record<string, unknown>).frequency, 'WEEKLY');
    assert.equal(bodies[1].allDay, true);
  } finally {
    restore();
  }
});

test('event mutation functions call the calendar endpoints', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    return init?.method === 'DELETE' && url === '/api/calendar/events/event-1'
      ? json({ ok: true })
      : json({ item: { id: 'event-1', title: 'Lecture' } });
  });
  try {
    await run('update_calendar_event', { calendarId: 'cal-1', eventId: 'event-1', title: 'Lecture', startsAt: '2026-06-23T13:00:00.000Z', endsAt: '2026-06-23T14:00:00.000Z' });
    await run('duplicate_calendar_event', { eventId: 'event-1' });
    await run('trash_calendar_event', { eventId: 'event-1' });
    await run('restore_calendar_event', { eventId: 'event-1' });
    await run('delete_calendar_event', { eventId: 'event-1' });
    assert.deepEqual(calls, [
      'PUT /api/calendar/events/event-1',
      'POST /api/calendar/events/event-1/duplicate',
      'POST /api/calendar/events/event-1/trash',
      'DELETE /api/calendar/events/event-1/trash',
      'DELETE /api/calendar/events/event-1',
    ]);
  } finally {
    restore();
  }
});

test('save_calendar_occurrence overrides and cancels recurring instances', async () => {
  const bodies: unknown[] = [];
  const restore = withMockFetch((_url, init) => {
    bodies.push(JSON.parse(String(init?.body)));
    return json({ item: { id: 'event-1', title: 'Lecture' } });
  });
  try {
    await run('save_calendar_occurrence', { eventId: 'event-1', occurrenceKey: event.occurrenceKey, action: 'override', override: { title: 'Review', startsAt: '2026-06-23T15:00:00.000Z' } });
    await run('save_calendar_occurrence', { eventId: 'event-1', occurrenceKey: event.occurrenceKey, action: 'cancel' });
    assert.equal((bodies[0] as Record<string, unknown>).action, 'override');
    assert.equal((bodies[1] as Record<string, unknown>).override, null);
  } finally {
    restore();
  }
});

test('task functions create, update, and delete tasks', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    return init?.method === 'DELETE' ? json({ ok: true }) : json({ item: { id: 'task-1', title: 'Submit essay' } });
  });
  try {
    await run('create_calendar_task', { title: 'Submit essay', dueDate: '2026-07-01', priority: 'high' });
    await run('update_calendar_task', { taskId: 'task-1', title: 'Submit essay', dueAt: '2026-07-01T16:00:00.000Z' });
    await run('delete_calendar_task', { taskId: 'task-1' });
    assert.deepEqual(calls, ['POST /api/calendar/tasks', 'PUT /api/calendar/tasks/task-1', 'DELETE /api/calendar/tasks/task-1']);
  } finally {
    restore();
  }
});

test('calendar metadata functions update lists, categories, settings, and undo', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/settings')) return json({ settings: { timezone: 'America/New_York' } });
    if (url.includes('/undo')) return json({ restored: true });
    const name = JSON.parse(String(init?.body || '{}')).name ?? 'Personal';
    return json({ item: { id: 'item-1', name } });
  });
  try {
    await run('create_calendar_list', { name: 'School', color: '#3b82f6' });
    await run('update_calendar_list', { calendarId: 'cal-1', visible: false });
    await run('create_calendar_category', { calendarId: 'cal-1', name: 'Exams' });
    await run('update_calendar_category', { categoryId: 'cat-1', name: 'Deadlines' });
    await run('update_calendar_settings', { timezone: 'America/New_York', weekStart: 'mon', hourCycle: '12', workingHoursStart: '08:00', workingHoursEnd: '17:00' });
    await run('undo_calendar_action');
    assert.deepEqual(calls, [
      'POST /api/calendar/calendars',
      'PUT /api/calendar/calendars/cal-1',
      'POST /api/calendar/categories',
      'PUT /api/calendar/categories/cat-1',
      'PUT /api/calendar/settings',
      'POST /api/calendar/undo',
    ]);
  } finally {
    restore();
  }
});

test('calendar tool validates required fields, ranges, and recurrence', async () => {
  assert.equal((await run('create_calendar_event', { calendarId: 'cal-1', startsAt: '2026-06-23T13:00:00.000Z', endsAt: '2026-06-23T14:00:00.000Z' })).ok, false);
  assert.equal((await run('list_calendar_events', { start: '2026-06-23T14:00:00.000Z', end: '2026-06-23T13:00:00.000Z' })).ok, false);
  assert.equal((await run('create_calendar_event', { calendarId: 'cal-1', title: 'Bad', startsAt: '2026-06-23T13:00:00.000Z', endsAt: '2026-06-23T14:00:00.000Z', recurrence: { frequency: 'HOURLY' } })).ok, false);
});
