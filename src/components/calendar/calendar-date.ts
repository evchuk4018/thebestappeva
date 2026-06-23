import type { CalendarEventInput, CalendarEventOccurrence, CalendarView, CalendarWeekStart } from '../../../shared/calendar-contract';

const dayMs = 86400000;

export function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function startOfWeek(date: Date, weekStart: CalendarWeekStart) {
  const start = startOfDay(date);
  const offset = (start.getDay() - (weekStart === 'mon' ? 1 : 0) + 7) % 7;
  return addDays(start, -offset);
}

export function viewRange(date: Date, view: CalendarView, weekStart: CalendarWeekStart) {
  if (view === 'day') return { start: startOfDay(date), end: addDays(startOfDay(date), 1) };
  if (view === 'week') {
    const start = startOfWeek(date, weekStart);
    return { start, end: addDays(start, 7) };
  }
  if (view === 'year') {
    const start = new Date(date.getFullYear(), 0, 1);
    return { start, end: new Date(date.getFullYear() + 1, 0, 1) };
  }
  if (view === 'agenda') return { start: startOfDay(date), end: addDays(startOfDay(date), 60) };
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, end: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
}

export function shiftDate(date: Date, view: CalendarView, direction: -1 | 1) {
  if (view === 'day') return addDays(date, direction);
  if (view === 'week') return addDays(date, direction * 7);
  if (view === 'year') return new Date(date.getFullYear() + direction, date.getMonth(), date.getDate());
  if (view === 'agenda') return addDays(date, direction * 30);
  return addMonths(date, direction);
}

export function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (let at = startOfDay(start); at < end; at = addDays(at, 1)) days.push(at);
  return days;
}

export function timeLabel(iso: string, hourCycle: '12' | '24') {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', hour12: hourCycle === '12' }).format(new Date(iso));
}

export function eventOnDay(event: CalendarEventOccurrence, date: Date) {
  const key = toDateInput(date);
  if (event.allDay) return (event.startDate ?? event.startsAt.slice(0, 10)) <= key && (event.endDate ?? event.endsAt.slice(0, 10)) >= key;
  return event.startsAt.slice(0, 10) === key || event.endsAt.slice(0, 10) === key;
}

export function defaultEventInput(calendarId: string, date = new Date(), title = 'New event'): CalendarEventInput {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 3600000);
  return { calendarId, title, notes: '', location: '', startsAt: start.toISOString(), endsAt: end.toISOString(), allDay: false, startDate: null, endDate: null };
}

export function durationMinutes(event: CalendarEventOccurrence) {
  return Math.max(15, Math.round((new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60000));
}

function recurrenceInput(event: CalendarEventOccurrence) {
  return event.recurrence ? {
    frequency: event.recurrence.frequency,
    interval: event.recurrence.interval,
    count: event.recurrence.count,
    until: event.recurrence.until,
    byWeekday: event.recurrence.byWeekday,
  } : null;
}

export function movedEvent(event: CalendarEventOccurrence, targetDate: Date): CalendarEventInput {
  const duration = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
  const start = new Date(targetDate);
  start.setHours(new Date(event.startsAt).getHours(), new Date(event.startsAt).getMinutes(), 0, 0);
  return { ...event, startsAt: start.toISOString(), endsAt: new Date(start.getTime() + duration).toISOString(), recurrence: recurrenceInput(event) };
}

export function resizedEvent(event: CalendarEventOccurrence, deltaMinutes: number): CalendarEventInput {
  const end = new Date(new Date(event.endsAt).getTime() + deltaMinutes * 60000);
  return { ...event, endsAt: end.toISOString(), recurrence: recurrenceInput(event) };
}
