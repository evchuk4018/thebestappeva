import type { Request, Response } from 'express';
import { parseWorkoutExerciseInput, parseWorkoutRoutineInput, parseWorkoutSession } from '../shared/workout-contract';
import { HttpError } from './http';
import { workoutRepository } from './db/workout-repository';

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

export async function handleGetWorkoutBootstrap(_request: Request, response: Response) {
  sendJson(response, workoutRepository.bootstrap());
}

export async function handleCreateWorkoutRoutine(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutRoutineInput(body(request)));
  sendJson(response, { item: workoutRepository.saveRoutine(null, input) });
}

export async function handlePutWorkoutRoutine(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutRoutineInput(body(request)));
  sendJson(response, { item: workoutRepository.saveRoutine(request.params.routineId, input) });
}

export async function handleDeleteWorkoutRoutine(request: Request, response: Response) {
  if (!workoutRepository.archiveRoutine(request.params.routineId)) throw new HttpError(404, 'Routine was not found.');
  sendJson(response, { ok: true });
}

export async function handleCreateWorkoutExercise(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseWorkoutExerciseInput(body(request)));
  sendJson(response, { item: workoutRepository.createExercise(input) });
}

export async function handleStartEmptyWorkoutSession(_request: Request, response: Response) {
  sendJson(response, { item: workoutRepository.startEmptySession() });
}

export async function handleStartRoutineWorkoutSession(request: Request, response: Response) {
  const item = workoutRepository.startRoutineSession(request.params.routineId);
  if (!item) throw new HttpError(404, 'Routine was not found.');
  sendJson(response, { item });
}

export async function handlePutWorkoutSession(request: Request, response: Response) {
  const session = parseOrBadRequest(() => parseWorkoutSession(body(request).session ?? body(request)));
  if (session.id !== request.params.sessionId) throw new HttpError(400, 'Session id mismatch.');
  const item = workoutRepository.saveSession(session);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleFinishWorkoutSession(request: Request, response: Response) {
  const session = parseOrBadRequest(() => parseWorkoutSession(body(request).session ?? body(request)));
  if (session.id !== request.params.sessionId) throw new HttpError(400, 'Session id mismatch.');
  const item = workoutRepository.finishSession(session);
  if (!item) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { item });
}

export async function handleDeleteWorkoutSession(request: Request, response: Response) {
  if (!workoutRepository.deleteSession(request.params.sessionId)) throw new HttpError(404, 'Workout session was not found.');
  sendJson(response, { ok: true });
}
