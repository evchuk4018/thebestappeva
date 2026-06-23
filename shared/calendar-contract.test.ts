import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCalendarEventInput, parseCalendarSettings, parseCalendarTaskInput, parseRecurrenceInput } from './calendar-contract';

test('parses calendar settings with defaults for constrained choices', () => {
  const parsed = parseCalendarSettings({
    timezone: 'America/New_York',
    weekStart: 'mon',
    hourCycle: '24',
    workingHoursStart: '08:00',
    workingHoursEnd: '16:30',
  });
  assert.equal(parsed.weekStart, 'mon');
  assert.equal(parsed.hourCycle, '24');
});

test('parses event input with recurrence and all-day dates', () => {
  const parsed = parseCalendarEventInput({
    calendarId: 'cal-1',
    categoryId: null,
    title: 'Design review',
    startsAt: '2026-06-23T13:00:00.000Z',
    endsAt: '2026-06-23T14:00:00.000Z',
    allDay: true,
    startDate: '2026-06-23',
    endDate: '2026-06-24',
    recurrence: { frequency: 'WEEKLY', interval: 2, byWeekday: ['TU'] },
  });
  assert.equal(parsed.title, 'Design review');
  assert.equal(parsed.recurrence?.frequency, 'WEEKLY');
  assert.equal(parsed.endDate, '2026-06-24');
});

test('rejects invalid recurrence frequency and timestamps', () => {
  assert.throws(() => parseRecurrenceInput({ frequency: 'HOURLY' }), /frequency/);
  assert.throws(() => parseCalendarEventInput({
    calendarId: 'cal-1',
    title: 'Bad',
    startsAt: 'not-a-date',
    endsAt: '2026-06-23T14:00:00.000Z',
  }), /startsAt/);
});

test('parses task input with priority and recurrence', () => {
  const parsed = parseCalendarTaskInput({
    title: 'Pay bill',
    dueDate: '2026-06-30',
    priority: 'high',
    recurrence: { frequency: 'MONTHLY', interval: 1 },
  });
  assert.equal(parsed.priority, 'high');
  assert.equal(parsed.recurrence?.frequency, 'MONTHLY');
});
