import type { Request, Response } from 'express';
import { parseCalendarEventInput, parseCalendarSettings, parseCalendarTaskInput } from '../shared/calendar-contract';
import type { ServerRequestDependencies } from './composition-root';
import { HttpError, getOptionalQueryParam } from './http';

type CalendarRouteDependencies = Pick<ServerRequestDependencies, 'calendarRepository'>;

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function body(request: Request) {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

function requireText(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `Missing ${field}.`);
  return value.trim();
}

function color(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '#ef4444';
}

function repository(dependencies: CalendarRouteDependencies) {
  return dependencies.calendarRepository;
}

export async function handleGetCalendarBootstrap(_request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, await repository(dependencies).bootstrap());
}

export async function handleListCalendarCalendars(_request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { calendars: await repository(dependencies).listCalendars(true) });
}

export async function handleCreateCalendarCalendar(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const payload = body(request);
  sendJson(response, { item: await repository(dependencies).createCalendar({ name: requireText(payload.name, 'name'), color: color(payload.color) }) });
}

export async function handlePutCalendarCalendar(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const payload = body(request);
  const item = await repository(dependencies).updateCalendar(request.params.calendarId, {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    color: typeof payload.color === 'string' ? payload.color : undefined,
    visible: typeof payload.visible === 'boolean' ? payload.visible : undefined,
  });
  if (!item) throw new HttpError(404, 'Calendar was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarCalendar(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).updateCalendar(request.params.calendarId, { visible: false });
  if (!item) throw new HttpError(404, 'Calendar was not found.');
  sendJson(response, { item });
}

export async function handleListCalendarCategories(_request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { categories: await repository(dependencies).listCategories(true) });
}

export async function handleCreateCalendarCategory(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const payload = body(request);
  sendJson(response, { item: await repository(dependencies).createCategory({ calendarId: requireText(payload.calendarId, 'calendarId'), name: requireText(payload.name, 'name'), color: color(payload.color) }) });
}

export async function handlePutCalendarCategory(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const payload = body(request);
  const item = await repository(dependencies).updateCategory(request.params.categoryId, {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    color: typeof payload.color === 'string' ? payload.color : undefined,
  });
  if (!item) throw new HttpError(404, 'Category was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarCategory(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).updateCategory(request.params.categoryId, { name: 'Archived' });
  if (!item) throw new HttpError(404, 'Category was not found.');
  sendJson(response, { item });
}

export async function handleListCalendarEvents(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const start = requireText(request.query.start, 'start');
  const end = requireText(request.query.end, 'end');
  sendJson(response, { events: await repository(dependencies).listEvents(start, end, getOptionalQueryParam(request.query.query), request.query.showTrash === 'true') });
}

export async function handleCreateCalendarEvent(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { item: await repository(dependencies).createEvent(parseCalendarEventInput(body(request))) });
}

export async function handlePutCalendarEvent(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).updateEvent(request.params.eventId, parseCalendarEventInput(body(request)));
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleDuplicateCalendarEvent(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).duplicateEvent(request.params.eventId);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleTrashCalendarEvent(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).setEventTrash(request.params.eventId, true);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleRestoreCalendarEvent(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).setEventTrash(request.params.eventId, false);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarEvent(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  if (!await repository(dependencies).deleteEvent(request.params.eventId)) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { ok: true });
}

export async function handleSaveCalendarOccurrence(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const payload = body(request);
  const action = payload.action === 'cancel' ? 'cancel' : 'override';
  const item = await repository(dependencies).saveOccurrence(request.params.eventId, request.params.occurrenceKey, action, payload.override as never);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleListCalendarTasks(_request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { tasks: await repository(dependencies).listTasks(true) });
}

export async function handleCreateCalendarTask(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { item: await repository(dependencies).createTask(parseCalendarTaskInput(body(request))) });
}

export async function handlePutCalendarTask(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  const item = await repository(dependencies).updateTask(request.params.taskId, parseCalendarTaskInput(body(request)));
  if (!item) throw new HttpError(404, 'Task was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarTask(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  if (!await repository(dependencies).deleteTask(request.params.taskId)) throw new HttpError(404, 'Task was not found.');
  sendJson(response, { ok: true });
}

export async function handlePutCalendarSettings(request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { settings: await repository(dependencies).saveSettings(parseCalendarSettings(body(request).settings ?? body(request))) });
}

export async function handlePostCalendarUndo(_request: Request, response: Response, dependencies: CalendarRouteDependencies) {
  sendJson(response, { ok: true, restored: await repository(dependencies).undoLast() });
}
