import type { Request, Response } from 'express';
import { parseWorkoutExerciseInput, parseWorkoutLoggedSessionInput, parseWorkoutRoutineInput, parseWorkoutSession } from '../shared/workout-contract';
import type { ServerRequestDependencies } from './composition-root';
import { HttpError } from './http';
import { getOptionalIntParam, getOptionalQueryParam } from './http';

type WorkoutRouteDependencies = Pick<ServerRequestDependencies, 'workoutRepository'>;

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

function repository(dependencies: WorkoutRouteDependencies) {
  return dependencies.workoutRepository;
}

export async function handleGetWorkoutBootstrap(_request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  sendJson(response, await repository(dependencies).bootstrap());
}

export async function handleGetWorkoutHistory(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  sendJson(response, {
    sessions: await repository(dependencies).listFinishedSessions({
      limit: getOptionalIntParam(request.query.limit, 20, 1, 100),
      query: getOptionalQueryParam(request.query.query),
      exerciseId: getOptionalQueryParam(request.query.exerciseId),
    }),
  });
}

export async function handleGetWorkoutSession(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const item = await repository(dependencies).getSession(request.params.sessionId);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleCreateWorkoutRoutine(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const input = parseOrBadRequest(() => parseWorkoutRoutineInput(body(request)));
  sendJson(response, { item: await repository(dependencies).saveRoutine(null, input) });
}

export async function handlePutWorkoutRoutine(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const input = parseOrBadRequest(() => parseWorkoutRoutineInput(body(request)));
  sendJson(response, { item: await repository(dependencies).saveRoutine(request.params.routineId, input) });
}

export async function handleDeleteWorkoutRoutine(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  if (!await repository(dependencies).archiveRoutine(request.params.routineId)) throw new HttpError(404, 'Routine was not found.');
  sendJson(response, { ok: true });
}

export async function handleCreateWorkoutExercise(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const input = parseOrBadRequest(() => parseWorkoutExerciseInput(body(request)));
  sendJson(response, { item: await repository(dependencies).createExercise(input) });
}

export async function handleStartEmptyWorkoutSession(_request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  sendJson(response, { item: await repository(dependencies).startEmptySession() });
}

export async function handleStartRoutineWorkoutSession(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const item = await repository(dependencies).startRoutineSession(request.params.routineId);
  if (!item) throw new HttpError(404, 'Routine was not found.');
  sendJson(response, { item });
}

export async function handlePutWorkoutSession(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const session = parseOrBadRequest(() => parseWorkoutSession(body(request).session ?? body(request)));
  if (session.id !== request.params.sessionId) throw new HttpError(400, 'Session id mismatch.');
  const item = await repository(dependencies).saveSession(session);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleFinishWorkoutSession(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const session = parseOrBadRequest(() => parseWorkoutSession(body(request).session ?? body(request)));
  if (session.id !== request.params.sessionId) throw new HttpError(400, 'Session id mismatch.');
  const item = await repository(dependencies).finishSession(session);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleLogWorkoutSession(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  const input = parseOrBadRequest(() => parseWorkoutLoggedSessionInput(body(request).session ?? body(request)));
  sendJson(response, { item: await repository(dependencies).logCompletedSession(input) });
}

export async function handleDeleteWorkoutSession(request: Request, response: Response, dependencies: WorkoutRouteDependencies) {
  if (!await repository(dependencies).deleteSession(request.params.sessionId)) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { ok: true });
}
