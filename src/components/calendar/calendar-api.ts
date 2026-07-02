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
import { requestJson } from '../../lib/api';

export async function fetchCalendarBootstrap(): Promise<CalendarBootstrap> {
  return requestJson('/calendar/bootstrap');
}

export async function fetchCalendarEvents(start: string, end: string, search: string, showTrash = false): Promise<CalendarEventOccurrence[]> {
  const payload = await requestJson<{ events?: CalendarEventOccurrence[] }>('/calendar/events', { query: { start, end, query: search, showTrash } });
  return Array.isArray(payload.events) ? payload.events : [];
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  return (await requestJson<{ item: CalendarEvent }>('/calendar/events', { method: 'POST', json: input })).item;
}

export async function updateCalendarEvent(eventId: string, input: CalendarEventInput): Promise<CalendarEvent> {
  return (await requestJson<{ item: CalendarEvent }>(`/calendar/events/${eventId}`, { method: 'PUT', json: input })).item;
}

export async function saveCalendarOccurrence(
  eventId: string,
  occurrenceKey: string,
  action: CalendarOccurrenceAction,
  override: Partial<CalendarEventInput> | null,
): Promise<CalendarEvent> {
  const key = encodeURIComponent(occurrenceKey);
  return (await requestJson<{ item: CalendarEvent }>(`/calendar/events/${eventId}/occurrences/${key}`, { method: 'POST', json: { action, override } })).item;
}

export async function duplicateCalendarEvent(eventId: string): Promise<CalendarEvent> {
  return (await requestJson<{ item: CalendarEvent }>(`/calendar/events/${eventId}/duplicate`, { method: 'POST' })).item;
}

export async function trashCalendarEvent(eventId: string): Promise<CalendarEvent> {
  return (await requestJson<{ item: CalendarEvent }>(`/calendar/events/${eventId}/trash`, { method: 'POST' })).item;
}

export async function restoreCalendarEvent(eventId: string): Promise<CalendarEvent> {
  return (await requestJson<{ item: CalendarEvent }>(`/calendar/events/${eventId}/trash`, { method: 'DELETE' })).item;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await requestJson(`/calendar/events/${eventId}`, { method: 'DELETE' });
}

export async function createCalendarTask(input: CalendarTaskInput): Promise<CalendarTask> {
  return (await requestJson<{ item: CalendarTask }>('/calendar/tasks', { method: 'POST', json: input })).item;
}

export async function updateCalendarTask(taskId: string, input: CalendarTaskInput): Promise<CalendarTask> {
  return (await requestJson<{ item: CalendarTask }>(`/calendar/tasks/${taskId}`, { method: 'PUT', json: input })).item;
}

export async function deleteCalendarTask(taskId: string): Promise<void> {
  await requestJson(`/calendar/tasks/${taskId}`, { method: 'DELETE' });
}

export async function createCalendarList(input: Pick<CalendarList, 'name' | 'color'>): Promise<CalendarList> {
  return (await requestJson<{ item: CalendarList }>('/calendar/calendars', { method: 'POST', json: input })).item;
}

export async function updateCalendarList(calendarId: string, input: Partial<Pick<CalendarList, 'name' | 'color' | 'visible'>>): Promise<CalendarList> {
  return (await requestJson<{ item: CalendarList }>(`/calendar/calendars/${calendarId}`, { method: 'PUT', json: input })).item;
}

export async function createCalendarCategory(input: Pick<CalendarCategory, 'calendarId' | 'name' | 'color'>): Promise<CalendarCategory> {
  return (await requestJson<{ item: CalendarCategory }>('/calendar/categories', { method: 'POST', json: input })).item;
}

export async function updateCalendarCategory(categoryId: string, input: Partial<Pick<CalendarCategory, 'name' | 'color'>>): Promise<CalendarCategory> {
  return (await requestJson<{ item: CalendarCategory }>(`/calendar/categories/${categoryId}`, { method: 'PUT', json: input })).item;
}

export async function updateCalendarSettings(settings: CalendarSettings): Promise<CalendarSettings> {
  return (await requestJson<{ settings: CalendarSettings }>('/calendar/settings', { method: 'PUT', json: { settings } })).settings;
}

export async function undoCalendarAction(): Promise<boolean> {
  return Boolean((await requestJson<{ restored?: boolean }>('/calendar/undo', { method: 'POST' })).restored);
}
