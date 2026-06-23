import type { WorkoutBootstrap, WorkoutExercise, WorkoutExerciseInput, WorkoutRoutine, WorkoutRoutineInput, WorkoutSession } from '../../../shared/workout-contract';

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({ error: 'The local server returned invalid JSON.' }));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with ${response.status}.`);
  return payload;
}

async function json(path: string, init?: RequestInit) {
  return readJson(await fetch(path, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init }));
}

export async function fetchWorkoutBootstrap(): Promise<WorkoutBootstrap> {
  return json('/api/workout/bootstrap');
}

export async function createWorkoutRoutine(input: WorkoutRoutineInput): Promise<WorkoutRoutine> {
  return (await json('/api/workout/routines', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateWorkoutRoutine(routineId: string, input: WorkoutRoutineInput): Promise<WorkoutRoutine> {
  return (await json(`/api/workout/routines/${routineId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function deleteWorkoutRoutine(routineId: string): Promise<void> {
  await json(`/api/workout/routines/${routineId}`, { method: 'DELETE' });
}

export async function createWorkoutExercise(input: WorkoutExerciseInput): Promise<WorkoutExercise> {
  return (await json('/api/workout/exercises', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function startEmptyWorkoutSession(): Promise<WorkoutSession> {
  return (await json('/api/workout/sessions/empty', { method: 'POST' })).item;
}

export async function startWorkoutSessionFromRoutine(routineId: string): Promise<WorkoutSession> {
  return (await json(`/api/workout/sessions/from-routine/${routineId}`, { method: 'POST' })).item;
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  return (await json(`/api/workout/sessions/${session.id}`, { method: 'PUT', body: JSON.stringify({ session }) })).item;
}

export async function finishWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  return (await json(`/api/workout/sessions/${session.id}/finish`, { method: 'POST', body: JSON.stringify({ session }) })).item;
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  await json(`/api/workout/sessions/${sessionId}`, { method: 'DELETE' });
}
