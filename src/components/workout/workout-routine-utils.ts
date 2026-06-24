import type { WorkoutRoutine, WorkoutRoutineInput } from '../../../shared/workout-contract';

export function createDuplicateRoutineName(name: string, routines: WorkoutRoutine[]) {
  const existing = new Set(routines.map((routine) => routine.name.trim().toLowerCase()));
  const base = `${name.trim()} Copy`;
  if (!existing.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (existing.has(`${base} ${suffix}`.toLowerCase())) suffix += 1;
  return `${base} ${suffix}`;
}

export function duplicateRoutineInput(routine: WorkoutRoutine, routines: WorkoutRoutine[]): WorkoutRoutineInput {
  return {
    name: createDuplicateRoutineName(routine.name, routines),
    exercises: routine.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      orderIndex: index,
      targetSets: exercise.targetSets,
    })),
  };
}
