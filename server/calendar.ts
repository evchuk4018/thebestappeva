import type { Request, Response } from 'express';
import { parseCalendarEventInput, parseCalendarSettings, parseCalendarTaskInput } from '../shared/calendar-contract';
import { getRequestAuthContext } from './auth/request-context';
import { createPostgresCalendarRepository } from './db/postgres-calendar-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { HttpError, getOptionalQueryParam } from './http';

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

function createRepository(request: Request) {
  return createPostgresCalendarRepository(getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId));
}

export async function handleGetCalendarBootstrap(request: Request, response: Response) {
  sendJson(response, await createRepository(request).bootstrap());
}

export async function handleListCalendarCalendars(request: Request, response: Response) {
  sendJson(response, { calendars: await createRepository(request).listCalendars(true) });
}

export async function handleCreateCalendarCalendar(request: Request, response: Response) {
  const payload = body(request);
  sendJson(response, { item: await createRepository(request).createCalendar({ name: requireText(payload.name, 'name'), color: color(payload.color) }) });
}

export async function handlePutCalendarCalendar(request: Request, response: Response) {
  const payload = body(request);
  const item = await createRepository(request).updateCalendar(request.params.calendarId, {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    color: typeof payload.color === 'string' ? payload.color : undefined,
    visible: typeof payload.visible === 'boolean' ? payload.visible : undefined,
  });
  if (!item) throw new HttpError(404, 'Calendar was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarCalendar(request: Request, response: Response) {
  const item = await createRepository(request).updateCalendar(request.params.calendarId, { visible: false });
  if (!item) throw new HttpError(404, 'Calendar was not found.');
  sendJson(response, { item });
}

export async function handleListCalendarCategories(request: Request, response: Response) {
  sendJson(response, { categories: await createRepository(request).listCategories(true) });
}

export async function handleCreateCalendarCategory(request: Request, response: Response) {
  const payload = body(request);
  sendJson(response, { item: await createRepository(request).createCategory({ calendarId: requireText(payload.calendarId, 'calendarId'), name: requireText(payload.name, 'name'), color: color(payload.color) }) });
}

export async function handlePutCalendarCategory(request: Request, response: Response) {
  const payload = body(request);
  const item = await createRepository(request).updateCategory(request.params.categoryId, {
    name: typeof payload.name === 'string' ? payload.name : undefined,
    color: typeof payload.color === 'string' ? payload.color : undefined,
  });
  if (!item) throw new HttpError(404, 'Category was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarCategory(request: Request, response: Response) {
  const item = await createRepository(request).updateCategory(request.params.categoryId, { name: 'Archived' });
  if (!item) throw new HttpError(404, 'Category was not found.');
  sendJson(response, { item });
}

export async function handleListCalendarEvents(request: Request, response: Response) {
  const start = requireText(request.query.start, 'start');
  const end = requireText(request.query.end, 'end');
  sendJson(response, { events: await createRepository(request).listEvents(start, end, getOptionalQueryParam(request.query.query), request.query.showTrash === 'true') });
}

export async function handleCreateCalendarEvent(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).createEvent(parseCalendarEventInput(body(request))) });
}

export async function handlePutCalendarEvent(request: Request, response: Response) {
  const item = await createRepository(request).updateEvent(request.params.eventId, parseCalendarEventInput(body(request)));
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleDuplicateCalendarEvent(request: Request, response: Response) {
  const item = await createRepository(request).duplicateEvent(request.params.eventId);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleTrashCalendarEvent(request: Request, response: Response) {
  const item = await createRepository(request).setEventTrash(request.params.eventId, true);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleRestoreCalendarEvent(request: Request, response: Response) {
  const item = await createRepository(request).setEventTrash(request.params.eventId, false);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarEvent(request: Request, response: Response) {
  if (!await createRepository(request).deleteEvent(request.params.eventId)) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { ok: true });
}

export async function handleSaveCalendarOccurrence(request: Request, response: Response) {
  const payload = body(request);
  const action = payload.action === 'cancel' ? 'cancel' : 'override';
  const item = await createRepository(request).saveOccurrence(request.params.eventId, request.params.occurrenceKey, action, payload.override as never);
  if (!item) throw new HttpError(404, 'Event was not found.');
  sendJson(response, { item });
}

export async function handleListCalendarTasks(request: Request, response: Response) {
  sendJson(response, { tasks: await createRepository(request).listTasks(true) });
}

export async function handleCreateCalendarTask(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).createTask(parseCalendarTaskInput(body(request))) });
}

export async function handlePutCalendarTask(request: Request, response: Response) {
  const item = await createRepository(request).updateTask(request.params.taskId, parseCalendarTaskInput(body(request)));
  if (!item) throw new HttpError(404, 'Task was not found.');
  sendJson(response, { item });
}

export async function handleDeleteCalendarTask(request: Request, response: Response) {
  if (!await createRepository(request).deleteTask(request.params.taskId)) throw new HttpError(404, 'Task was not found.');
  sendJson(response, { ok: true });
}

export async function handlePutCalendarSettings(request: Request, response: Response) {
  sendJson(response, { settings: await createRepository(request).saveSettings(parseCalendarSettings(body(request).settings ?? body(request))) });
}

export async function handlePostCalendarUndo(request: Request, response: Response) {
  sendJson(response, { ok: true, restored: await createRepository(request).undoLast() });
}
