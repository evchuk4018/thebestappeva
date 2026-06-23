import rrulePackage from 'rrule';
import type { CalendarEvent, CalendarEventOccurrence, CalendarRecurrence, CalendarRecurrenceInput } from '../shared/calendar-contract';

const { RRule, rrulestr } = rrulePackage;

export interface CalendarExceptionRow {
  id: string;
  eventId: string;
  occurrenceKey: string;
  action: 'override' | 'cancel';
  override: Partial<CalendarEvent> | null;
}

const frequencyMap = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
  YEARLY: RRule.YEARLY,
} as const;

const weekdayMap: Record<string, typeof RRule.MO> = {
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH, FR: RRule.FR, SA: RRule.SA, SU: RRule.SU,
};

function addMs(iso: string, deltaMs: number) {
  return new Date(new Date(iso).getTime() + deltaMs).toISOString();
}

function dateKey(iso: string) {
  return iso.slice(0, 10);
}

export function createRRuleText(input: CalendarRecurrenceInput, startsAt: string) {
  const weekdays = (input.byWeekday ?? []).map((weekday) => weekdayMap[weekday]).filter(Boolean);
  return new RRule({
    freq: frequencyMap[input.frequency],
    interval: input.interval ?? 1,
    count: input.count ?? undefined,
    until: input.until ? new Date(input.until) : undefined,
    byweekday: weekdays.length ? weekdays : undefined,
    dtstart: new Date(startsAt),
  }).toString();
}

export function recurrenceFromInput(input: CalendarRecurrenceInput, startsAt: string, now: string) {
  return {
    frequency: input.frequency,
    interval: input.interval ?? 1,
    count: input.count ?? null,
    until: input.until ?? null,
    byWeekday: input.byWeekday ?? [],
    rruleText: createRRuleText(input, startsAt),
    createdAt: now,
    updatedAt: now,
  };
}

function buildOccurrence(event: CalendarEvent, startsAt: string, exception?: CalendarExceptionRow): CalendarEventOccurrence | null {
  if (exception?.action === 'cancel') return null;
  const durationMs = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
  const base: CalendarEvent = {
    ...event,
    startsAt,
    endsAt: addMs(startsAt, durationMs),
    startDate: event.allDay ? dateKey(startsAt) : event.startDate,
    endDate: event.allDay ? dateKey(addMs(startsAt, durationMs)) : event.endDate,
  };
  const overridden = exception?.override ? { ...base, ...exception.override } : base;
  return {
    ...overridden,
    occurrenceId: `${event.id}:${startsAt}`,
    masterEventId: event.id,
    occurrenceKey: startsAt,
    isRecurring: Boolean(event.recurrence),
    isException: Boolean(exception),
    conflict: false,
  };
}

export function expandEvent(event: CalendarEvent, rangeStart: string, rangeEnd: string, exceptions: CalendarExceptionRow[] = []) {
  if (!event.recurrence) {
    return intersects(event.startsAt, event.endsAt, rangeStart, rangeEnd)
      ? [buildOccurrence(event, event.startsAt)!]
      : [];
  }
  const exceptionMap = new Map(exceptions.map((exception) => [exception.occurrenceKey, exception]));
  const rule = rrulestr(event.recurrence.rruleText);
  return rule.between(new Date(rangeStart), new Date(rangeEnd), true)
    .map((date) => date.toISOString())
    .map((startsAt) => buildOccurrence(event, startsAt, exceptionMap.get(startsAt)))
    .filter((occurrence): occurrence is CalendarEventOccurrence => Boolean(occurrence));
}

export function intersects(startsAt: string, endsAt: string, rangeStart: string, rangeEnd: string) {
  return startsAt < rangeEnd && endsAt > rangeStart;
}

export function markConflicts(events: CalendarEventOccurrence[]) {
  return events.map((event, index) => {
    if (event.allDay) return event;
    const conflict = events.some((other, otherIndex) => otherIndex !== index && !other.allDay && intersects(event.startsAt, event.endsAt, other.startsAt, other.endsAt));
    return { ...event, conflict };
  });
}
