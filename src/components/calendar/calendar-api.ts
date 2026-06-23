import type {
  CalendarBootstrap,
  CalendarCategory,
  CalendarEvent,
  CalendarEventInput,
  CalendarEventOccurrence,
  CalendarList,
  CalendarOccurrenceAction,
  CalendarSettings,
  CalendarTask,
  CalendarTaskInput,
} from '../../../shared/calendar-contract';

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({ error: 'The local server returned invalid JSON.' }));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with ${response.status}.`);
  return payload;
}

async function json(path: string, init?: RequestInit) {
  return readJson(await fetch(path, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init }));
}

function query(path: string, params: Record<string, string | boolean | null | undefined>) {
  const baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

export async function fetchCalendarBootstrap(): Promise<CalendarBootstrap> {
  return json('/api/calendar/bootstrap');
}

export async function fetchCalendarEvents(start: string, end: string, search: string, showTrash = false): Promise<CalendarEventOccurrence[]> {
  const payload = await json(query('/api/calendar/events', { start, end, query: search, showTrash }));
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  return (await json('/api/calendar/events', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateCalendarEvent(eventId: string, input: CalendarEventInput): Promise<CalendarEvent> {
  return (await json(`/api/calendar/events/${eventId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function saveCalendarOccurrence(
  eventId: string,
  occurrenceKey: string,
  action: CalendarOccurrenceAction,
  override: Partial<CalendarEventInput> | null,
): Promise<CalendarEvent> {
  const key = encodeURIComponent(occurrenceKey);
  return (await json(`/api/calendar/events/${eventId}/occurrences/${key}`, { method: 'POST', body: JSON.stringify({ action, override }) })).item;
}

export async function duplicateCalendarEvent(eventId: string): Promise<CalendarEvent> {
  return (await json(`/api/calendar/events/${eventId}/duplicate`, { method: 'POST' })).item;
}

export async function trashCalendarEvent(eventId: string): Promise<CalendarEvent> {
  return (await json(`/api/calendar/events/${eventId}/trash`, { method: 'POST' })).item;
}

export async function restoreCalendarEvent(eventId: string): Promise<CalendarEvent> {
  return (await json(`/api/calendar/events/${eventId}/trash`, { method: 'DELETE' })).item;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await json(`/api/calendar/events/${eventId}`, { method: 'DELETE' });
}

export async function createCalendarTask(input: CalendarTaskInput): Promise<CalendarTask> {
  return (await json('/api/calendar/tasks', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateCalendarTask(taskId: string, input: CalendarTaskInput): Promise<CalendarTask> {
  return (await json(`/api/calendar/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function deleteCalendarTask(taskId: string): Promise<void> {
  await json(`/api/calendar/tasks/${taskId}`, { method: 'DELETE' });
}

export async function createCalendarList(input: Pick<CalendarList, 'name' | 'color'>): Promise<CalendarList> {
  return (await json('/api/calendar/calendars', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateCalendarList(calendarId: string, input: Partial<Pick<CalendarList, 'name' | 'color' | 'visible'>>): Promise<CalendarList> {
  return (await json(`/api/calendar/calendars/${calendarId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function createCalendarCategory(input: Pick<CalendarCategory, 'calendarId' | 'name' | 'color'>): Promise<CalendarCategory> {
  return (await json('/api/calendar/categories', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateCalendarCategory(categoryId: string, input: Partial<Pick<CalendarCategory, 'name' | 'color'>>): Promise<CalendarCategory> {
  return (await json(`/api/calendar/categories/${categoryId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function updateCalendarSettings(settings: CalendarSettings): Promise<CalendarSettings> {
  return (await json('/api/calendar/settings', { method: 'PUT', body: JSON.stringify({ settings }) })).settings;
}

export async function undoCalendarAction(): Promise<boolean> {
  return Boolean((await json('/api/calendar/undo', { method: 'POST' })).restored);
}
