export interface WorkoutExercise {
  id: string; name: string; category: string; equipment: string;
  isPreset: boolean; createdAt: string; updatedAt: string;
}

export interface WorkoutRoutineExercise {
  id: string; routineId: string; exerciseId: string; exerciseName: string;
  orderIndex: number; targetSets: number;
}

export interface WorkoutRoutine {
  id: string; name: string; exerciseSummary: string;
  exercises: WorkoutRoutineExercise[]; createdAt: string; updatedAt: string;
}

export interface WorkoutSet {
  id: string; sessionExerciseId: string; setIndex: number;
  rir: number | null; reps: number | null; weight: number | null; completed: boolean;
}

export interface WorkoutSessionExercise {
  id: string; sessionId: string; exerciseId: string; exerciseName: string;
  orderIndex: number; notes: string; lastPerformedText: string | null; sets: WorkoutSet[];
}

export interface WorkoutSession {
  id: string; routineId: string | null; name: string; startedAt: string;
  finishedAt: string | null; updatedAt: string; exercises: WorkoutSessionExercise[];
}

export interface WorkoutRoutineInput {
  name: string;
  exercises: Array<{ exerciseId: string; orderIndex?: number; targetSets?: number }>;
}

export interface WorkoutExerciseInput { name: string; category?: string; equipment?: string; }
export interface WorkoutBootstrap { exercises: WorkoutExercise[]; routines: WorkoutRoutine[]; activeSession: WorkoutSession | null; }
export interface WorkoutEntityResponse<T> { item: T; }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function record(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value;
}

function str(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`Invalid ${field}. Expected a string.`);
  return value;
}

function nonEmpty(value: unknown, field: string) {
  const text = str(value, field).trim();
  if (!text) throw new Error(`Invalid ${field}. Expected a non-empty string.`);
  return text;
}

function optNum(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${field}. Expected a non-negative number.`);
  return number;
}

function num(value: unknown, field: string, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid ${field}. Expected a non-negative number.`);
  return Math.round(number);
}

function arr(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value;
}

export function parseWorkoutExerciseInput(value: unknown, field = 'Exercise input'): WorkoutExerciseInput {
  const item = record(value, field);
  return {
    name: nonEmpty(item.name, `${field}.name`),
    category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Custom',
    equipment: typeof item.equipment === 'string' && item.equipment.trim() ? item.equipment.trim() : 'Other',
  };
}

export function parseWorkoutRoutineInput(value: unknown, field = 'Routine input'): WorkoutRoutineInput {
  const item = record(value, field);
  return {
    name: nonEmpty(item.name, `${field}.name`),
    exercises: arr(item.exercises, `${field}.exercises`).map((entry, index) => {
      const exercise = record(entry, `${field}.exercises[${index}]`);
      return {
        exerciseId: nonEmpty(exercise.exerciseId, `${field}.exercises[${index}].exerciseId`),
        orderIndex: num(exercise.orderIndex, `${field}.exercises[${index}].orderIndex`, index),
        targetSets: Math.max(1, num(exercise.targetSets, `${field}.exercises[${index}].targetSets`, 3)),
      };
    }),
  };
}

export function parseWorkoutSession(value: unknown, field = 'Workout session'): WorkoutSession {
  const item = record(value, field);
  return {
    id: nonEmpty(item.id, `${field}.id`),
    routineId: item.routineId === null || item.routineId === undefined ? null : nonEmpty(item.routineId, `${field}.routineId`),
    name: nonEmpty(item.name, `${field}.name`),
    startedAt: nonEmpty(item.startedAt, `${field}.startedAt`),
    finishedAt: item.finishedAt === null || item.finishedAt === undefined ? null : nonEmpty(item.finishedAt, `${field}.finishedAt`),
    updatedAt: nonEmpty(item.updatedAt, `${field}.updatedAt`),
    exercises: arr(item.exercises, `${field}.exercises`).map((entry, index) => parseSessionExercise(entry, `${field}.exercises[${index}]`)),
  };
}

function parseSessionExercise(value: unknown, field: string): WorkoutSessionExercise {
  const item = record(value, field);
  return {
    id: nonEmpty(item.id, `${field}.id`),
    sessionId: nonEmpty(item.sessionId, `${field}.sessionId`),
    exerciseId: nonEmpty(item.exerciseId, `${field}.exerciseId`),
    exerciseName: nonEmpty(item.exerciseName, `${field}.exerciseName`),
    orderIndex: num(item.orderIndex, `${field}.orderIndex`),
    notes: typeof item.notes === 'string' ? item.notes : '',
    lastPerformedText: item.lastPerformedText === null || item.lastPerformedText === undefined ? null : str(item.lastPerformedText, `${field}.lastPerformedText`),
    sets: arr(item.sets, `${field}.sets`).map((entry, index) => parseWorkoutSet(entry, `${field}.sets[${index}]`)),
  };
}

function parseWorkoutSet(value: unknown, field: string): WorkoutSet {
  const item = record(value, field);
  return {
    id: nonEmpty(item.id, `${field}.id`),
    sessionExerciseId: nonEmpty(item.sessionExerciseId, `${field}.sessionExerciseId`),
    setIndex: num(item.setIndex, `${field}.setIndex`),
    rir: optNum(item.rir, `${field}.rir`),
    reps: optNum(item.reps, `${field}.reps`),
    weight: optNum(item.weight, `${field}.weight`),
    completed: Boolean(item.completed),
  };
}
