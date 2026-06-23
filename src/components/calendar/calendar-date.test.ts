import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEventOccurrence } from '../../../shared/calendar-contract';
import { durationMinutes, eventOnDay, movedEvent, resizedEvent, viewRange } from './calendar-date';

const event: CalendarEventOccurrence = {
  id: 'event-1',
  calendarId: 'cal-1',
  categoryId: null,
  title: 'Focus',
  notes: '',
  location: '',
  timezone: 'UTC',
  startsAt: '2026-06-23T13:00:00.000Z',
  endsAt: '2026-06-23T14:00:00.000Z',
  allDay: false,
  startDate: null,
  endDate: null,
  recurrence: null,
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
  trashedAt: null,
  occurrenceId: 'event-1:2026-06-23T13:00:00.000Z',
  masterEventId: 'event-1',
  occurrenceKey: '2026-06-23T13:00:00.000Z',
  isRecurring: false,
  isException: false,
  conflict: false,
};

test('viewRange computes week starts from settings', () => {
  const range = viewRange(new Date('2026-06-24T12:00:00.000Z'), 'week', 'mon');
  assert.equal(range.start.toISOString().slice(0, 10), '2026-06-22');
  assert.equal(range.end.toISOString().slice(0, 10), '2026-06-29');
});

test('eventOnDay matches timed and all-day events', () => {
  assert.equal(eventOnDay(event, new Date('2026-06-23T12:00:00.000Z')), true);
  assert.equal(eventOnDay({ ...event, allDay: true, startDate: '2026-06-22', endDate: '2026-06-24' }, new Date('2026-06-24T12:00:00.000Z')), true);
});

test('move and resize preserve event duration intent', () => {
  const moved = movedEvent(event, new Date('2026-06-25T09:00:00.000Z'));
  assert.equal(moved.startsAt.slice(0, 10), '2026-06-25');
  const resized = resizedEvent(event, 30);
  assert.equal(durationMinutes({ ...event, endsAt: resized.endsAt }), 90);
});
