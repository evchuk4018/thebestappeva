import type { WorkoutExercise, WorkoutHistoryEntry, WorkoutRoutine, WorkoutRoutineExercise, WorkoutSession, WorkoutSessionExercise, WorkoutSet } from '../../shared/workout-contract';

export type WorkoutRow = Record<string, string | number | null>;
export const localWorkoutOwnerId = 'local-user';

export function mapExercise(row: WorkoutRow): WorkoutExercise {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    equipment: String(row.equipment),
    isPreset: Number(row.is_preset) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapRoutine(row: WorkoutRow, exercises: WorkoutRoutineExercise[]): WorkoutRoutine {
  const names = exercises.map((exercise) => exercise.exerciseName);
  return {
    id: String(row.id),
    name: String(row.name),
    exerciseSummary: names.length ? names.join(', ') : 'No exercises yet',
    exercises,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapHistoryEntry(row: WorkoutRow): WorkoutHistoryEntry {
  return {
    id: String(row.id),
    routineId: row.routine_id ? String(row.routine_id) : null,
    name: String(row.name),
    startedAt: String(row.started_at),
    finishedAt: String(row.finished_at),
    updatedAt: String(row.updated_at),
    exerciseNames: String(row.exercise_names ?? '').split('|').filter(Boolean),
    exerciseCount: Number(row.exercise_count ?? 0),
    completedSetCount: Number(row.completed_set_count ?? 0),
  };
}

export function mapRoutineExercise(row: WorkoutRow): WorkoutRoutineExercise {
  return {
    id: String(row.id),
    routineId: String(row.routine_id),
    exerciseId: String(row.exercise_id),
    exerciseName: String(row.exercise_name),
    orderIndex: Number(row.order_index),
    targetSets: Number(row.target_sets),
  };
}

export function mapSet(row: WorkoutRow): WorkoutSet {
  return {
    id: String(row.id),
    sessionExerciseId: String(row.session_exercise_id),
    setIndex: Number(row.set_index),
    rir: row.rir === null ? null : Number(row.rir),
    reps: row.reps === null ? null : Number(row.reps),
    weight: row.weight === null ? null : Number(row.weight),
    completed: Number(row.completed) === 1,
  };
}

export function mapSessionExercise(row: WorkoutRow, sets: WorkoutSet[], lastPerformedText: string | null): WorkoutSessionExercise {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    exerciseId: String(row.exercise_id),
    exerciseName: String(row.exercise_name),
    orderIndex: Number(row.order_index),
    notes: String(row.notes ?? ''),
    lastPerformedText,
    sets,
  };
}

export function mapSession(row: WorkoutRow, exercises: WorkoutSessionExercise[]): WorkoutSession {
  return {
    id: String(row.id),
    routineId: row.routine_id ? String(row.routine_id) : null,
    name: String(row.name),
    startedAt: String(row.started_at),
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    updatedAt: String(row.updated_at),
    exercises,
  };
}
