import type {
  WorkoutBootstrap,
  WorkoutExercise,
  WorkoutExerciseInput,
  WorkoutHistoryEntry,
  WorkoutLoggedSessionInput,
  WorkoutRoutine,
  WorkoutRoutineInput,
  WorkoutSession,
} from '../../../shared/workout-contract';
import { requestJson } from '../../lib/api';

export async function fetchWorkoutBootstrap(): Promise<WorkoutBootstrap> {
  return requestJson('/workout/bootstrap');
}

export async function fetchWorkoutHistory(options: { limit?: number; query?: string; exerciseId?: string } = {}): Promise<WorkoutHistoryEntry[]> {
  const payload = await requestJson<{ sessions?: WorkoutHistoryEntry[] }>('/workout/history', { query: options });
  return Array.isArray(payload.sessions) ? payload.sessions : [];
}

export async function fetchWorkoutSession(sessionId: string): Promise<WorkoutSession> {
  return (await requestJson<{ item: WorkoutSession }>(`/workout/sessions/${sessionId}`)).item;
}

export async function createWorkoutRoutine(input: WorkoutRoutineInput): Promise<WorkoutRoutine> {
  return (await requestJson<{ item: WorkoutRoutine }>('/workout/routines', { method: 'POST', json: input })).item;
}

export async function updateWorkoutRoutine(routineId: string, input: WorkoutRoutineInput): Promise<WorkoutRoutine> {
  return (await requestJson<{ item: WorkoutRoutine }>(`/workout/routines/${routineId}`, { method: 'PUT', json: input })).item;
}

export async function deleteWorkoutRoutine(routineId: string): Promise<void> {
  await requestJson(`/workout/routines/${routineId}`, { method: 'DELETE' });
}

export async function createWorkoutExercise(input: WorkoutExerciseInput): Promise<WorkoutExercise> {
  return (await requestJson<{ item: WorkoutExercise }>('/workout/exercises', { method: 'POST', json: input })).item;
}

export async function startEmptyWorkoutSession(): Promise<WorkoutSession> {
  return (await requestJson<{ item: WorkoutSession }>('/workout/sessions/empty', { method: 'POST' })).item;
}

export async function startWorkoutSessionFromRoutine(routineId: string): Promise<WorkoutSession> {
  return (await requestJson<{ item: WorkoutSession }>(`/workout/sessions/from-routine/${routineId}`, { method: 'POST' })).item;
}

export async function saveWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  return (await requestJson<{ item: WorkoutSession }>(`/workout/sessions/${session.id}`, { method: 'PUT', json: { session } })).item;
}

export async function finishWorkoutSession(session: WorkoutSession): Promise<WorkoutSession> {
  return (await requestJson<{ item: WorkoutSession }>(`/workout/sessions/${session.id}/finish`, { method: 'POST', json: { session } })).item;
}

export async function logWorkoutSession(session: WorkoutLoggedSessionInput): Promise<WorkoutSession> {
  return (await requestJson<{ item: WorkoutSession }>('/workout/sessions/log', { method: 'POST', json: { session } })).item;
}

export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  await requestJson(`/workout/sessions/${sessionId}`, { method: 'DELETE' });
}
