import { parseWorkoutExerciseInput, parseWorkoutLoggedSessionInput, parseWorkoutRoutineInput, parseWorkoutSession } from '../../../../shared/workout-contract';

export function requiredString(args: Record<string, unknown>, name: string) {
  const value = args[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`workout requires a non-empty \`${name}\` argument.`);
  return value.trim();
}

function requiredObject(args: Record<string, unknown>, name: string) {
  const value = args[name];
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`workout requires \`${name}\` as an object.`);
  return value;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalLimit(value: unknown, fallback: number, max: number) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) throw new Error('workout requires `limit` as a positive number.');
  return Math.min(max, Math.round(value));
}

export function parseExerciseSearchArgs(args: Record<string, unknown>) {
  return {
    query: optionalString(args.query)?.toLowerCase() ?? '',
    category: optionalString(args.category)?.toLowerCase() ?? '',
    equipment: optionalString(args.equipment)?.toLowerCase() ?? '',
    limit: optionalLimit(args.limit, 25, 100),
  };
}

export function parseHistoryArgs(args: Record<string, unknown>) {
  return {
    limit: optionalLimit(args.limit, 20, 100),
    query: optionalString(args.query) ?? '',
    exerciseId: optionalString(args.exerciseId),
  };
}

export function parseExerciseInputArg(args: Record<string, unknown>) {
  return parseWorkoutExerciseInput(args, 'Workout exercise');
}

export function parseRoutineInputArg(args: Record<string, unknown>) {
  return parseWorkoutRoutineInput(requiredObject(args, 'routine'), 'Workout routine');
}

export function parseSessionArg(args: Record<string, unknown>) {
  return parseWorkoutSession(requiredObject(args, 'session'));
}

export function parseLoggedSessionArg(args: Record<string, unknown>) {
  return parseWorkoutLoggedSessionInput(requiredObject(args, 'session'));
}
