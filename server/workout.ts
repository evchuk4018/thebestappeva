import type { Request, Response } from 'express';
import { parseWorkoutExerciseInput, parseWorkoutLoggedSessionInput, parseWorkoutRoutineInput, parseWorkoutSession } from '../shared/workout-contract';
import { getRequestAuthContext } from './auth/request-context';
import { createPostgresWorkoutRepository } from './db/postgres-workout-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { HttpError } from './http';
import { getOptionalIntParam, getOptionalQueryParam } from './http';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function body(request: Request) {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

function parseOrBadRequest<T>(reader: () => T) {
  try {
    return reader();
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid workout request.');
  }
}

function createRepository(request: Request) {
  return createPostgresWorkoutRepository(getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId));
}

export async function handleGetWorkoutBootstrap(request: Request, response: Response) {
  sendJson(response, await createRepository(request).bootstrap());
}

export async function handleGetWorkoutHistory(request: Request, response: Response) {
  sendJson(response, {
    sessions: await createRepository(request).listFinishedSessions({
      limit: getOptionalIntParam(request.query.limit, 20, 1, 100),
      query: getOptionalQueryParam(request.query.query),
      exerciseId: getOptionalQueryParam(request.query.exerciseId),
    }),
  });
}

export async function handleGetWorkoutSession(request: Request, response: Response) {
  const item = await createRepository(request).getSession(request.params.sessionId);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleCreateWorkoutRoutine(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutRoutineInput(body(request)));
  sendJson(response, { item: await createRepository(request).saveRoutine(null, input) });
}

export async function handlePutWorkoutRoutine(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutRoutineInput(body(request)));
  sendJson(response, { item: await createRepository(request).saveRoutine(request.params.routineId, input) });
}

export async function handleDeleteWorkoutRoutine(request: Request, response: Response) {
  if (!await createRepository(request).archiveRoutine(request.params.routineId)) throw new HttpError(404, 'Routine was not found.');
  sendJson(response, { ok: true });
}

export async function handleCreateWorkoutExercise(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutExerciseInput(body(request)));
  sendJson(response, { item: await createRepository(request).createExercise(input) });
}

export async function handleStartEmptyWorkoutSession(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).startEmptySession() });
}

export async function handleStartRoutineWorkoutSession(request: Request, response: Response) {
  const item = await createRepository(request).startRoutineSession(request.params.routineId);
  if (!item) throw new HttpError(404, 'Routine was not found.');
  sendJson(response, { item });
}

export async function handlePutWorkoutSession(request: Request, response: Response) {
  const session = parseOrBadRequest(() => parseWorkoutSession(body(request).session ?? body(request)));
  if (session.id !== request.params.sessionId) throw new HttpError(400, 'Session id mismatch.');
  const item = await createRepository(request).saveSession(session);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleFinishWorkoutSession(request: Request, response: Response) {
  const session = parseOrBadRequest(() => parseWorkoutSession(body(request).session ?? body(request)));
  if (session.id !== request.params.sessionId) throw new HttpError(400, 'Session id mismatch.');
  const item = await createRepository(request).finishSession(session);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleLogWorkoutSession(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutLoggedSessionInput(body(request).session ?? body(request)));
  sendJson(response, { item: await createRepository(request).logCompletedSession(input) });
}

export async function handleDeleteWorkoutSession(request: Request, response: Response) {
  if (!await createRepository(request).deleteSession(request.params.sessionId)) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { ok: true });
}
