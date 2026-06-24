import type { WorkoutRoutine, WorkoutRoutineInput, WorkoutSession } from '../../../shared/workout-contract';

export type WorkoutFinishPrompt = { kind: 'routine-update'; routine: WorkoutRoutine } | { kind: 'save-routine' };

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

export function sessionToRoutineInput(session: WorkoutSession, name = session.name): WorkoutRoutineInput {
  return {
    name: name.trim(),
    exercises: session.exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      orderIndex: index,
      targetSets: Math.max(1, exercise.sets.length),
    })),
  };
}

export function hasRoutineStructureChanges(session: WorkoutSession, routine: WorkoutRoutine) {
  if (session.exercises.length !== routine.exercises.length) return true;
  return session.exercises.some((exercise, index) => {
    const routineExercise = routine.exercises[index];
    return exercise.exerciseId !== routineExercise.exerciseId || Math.max(1, exercise.sets.length) !== routineExercise.targetSets;
  });
}

export function getWorkoutFinishPrompt(session: WorkoutSession, routines: WorkoutRoutine[]): WorkoutFinishPrompt | null {
  if (session.routineId) {
    const routine = routines.find((item) => item.id === session.routineId);
    return routine && hasRoutineStructureChanges(session, routine) ? { kind: 'routine-update', routine } : null;
  }
  return session.exercises.length > 0 ? { kind: 'save-routine' } : null;
}
