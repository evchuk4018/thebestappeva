import type { WorkoutExercise, WorkoutSession, WorkoutSessionExercise, WorkoutSet } from '../../../shared/workout-contract';

function localId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function makeWorkoutSet(sessionExerciseId: string, setIndex: number): WorkoutSet {
  return { id: localId('set'), sessionExerciseId, setIndex, rir: null, reps: null, weight: null, completed: false };
}

export function makeSessionExercise(sessionId: string, exercise: WorkoutExercise, orderIndex: number): WorkoutSessionExercise {
  const id = localId('sex');
  return {
    id,
    sessionId,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    orderIndex,
    notes: '',
    lastPerformedText: null,
    sets: [makeWorkoutSet(id, 0), makeWorkoutSet(id, 1), makeWorkoutSet(id, 2)],
  };
}

export function renumberSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      orderIndex: exerciseIndex,
      sets: exercise.sets.map((set, setIndex) => ({ ...set, setIndex })),
    })),
  };
}

export function moveSessionExercise(session: WorkoutSession, draggedExerciseId: string, targetExerciseId: string) {
  if (draggedExerciseId === targetExerciseId) return session;
  const fromIndex = session.exercises.findIndex((exercise) => exercise.id === draggedExerciseId);
  const toIndex = session.exercises.findIndex((exercise) => exercise.id === targetExerciseId);
  if (fromIndex < 0 || toIndex < 0) return session;
  const nextExercises = [...session.exercises];
  const [dragged] = nextExercises.splice(fromIndex, 1);
  nextExercises.splice(toIndex, 0, dragged);
  return renumberSession({ ...session, exercises: nextExercises });
}

export function sessionVolume(session: WorkoutSession) {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => {
    return sum + (set.completed && set.reps && set.weight ? set.reps * set.weight : 0);
  }, 0), 0);
}

export function completedSetCount(session: WorkoutSession) {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.filter((set) => set.completed).length, 0);
}
