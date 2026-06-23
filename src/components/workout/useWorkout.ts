import { useCallback, useEffect, useState } from 'react';
import type { WorkoutExercise, WorkoutExerciseInput, WorkoutRoutine, WorkoutRoutineInput, WorkoutSession } from '../../../shared/workout-contract';
import {
  createWorkoutExercise,
  createWorkoutRoutine,
  deleteWorkoutRoutine,
  deleteWorkoutSession,
  fetchWorkoutBootstrap,
  finishWorkoutSession,
  saveWorkoutSession,
  startEmptyWorkoutSession,
  startWorkoutSessionFromRoutine,
  updateWorkoutRoutine,
} from './workout-api';

export function useWorkout() {
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const bootstrap = await fetchWorkoutBootstrap();
      setExercises(bootstrap.exercises);
      setRoutines(bootstrap.routines);
      setSession(bootstrap.activeSession);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load workouts.');
    } finally {
      setBusy(false);
    }
  }, []);

  const run = useCallback(async <T,>(action: () => Promise<T>, after?: (value: T) => void) => {
    setError(null);
    try {
      const value = await action();
      after?.(value);
      return value;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Workout action failed.');
      return null;
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    exercises, routines, session, busy, error,
    refresh,
    startEmpty: () => run(startEmptyWorkoutSession, setSession),
    startRoutine: (routineId: string) => run(() => startWorkoutSessionFromRoutine(routineId), setSession),
    saveSession: (next: WorkoutSession) => {
      setSession(next);
      return run(() => saveWorkoutSession(next), setSession);
    },
    finishSession: (next: WorkoutSession) => run(() => finishWorkoutSession(next), () => {
      setSession(null);
      void refresh();
    }),
    cancelSession: (sessionId: string) => run(() => deleteWorkoutSession(sessionId), () => {
      setSession(null);
      void refresh();
    }),
    saveRoutine: (routineId: string | null, input: WorkoutRoutineInput) => run(
      () => routineId ? updateWorkoutRoutine(routineId, input) : createWorkoutRoutine(input),
      () => void refresh(),
    ),
    deleteRoutine: (routineId: string) => run(() => deleteWorkoutRoutine(routineId), () => void refresh()),
    createExercise: (input: WorkoutExerciseInput) => run<WorkoutExercise>(() => createWorkoutExercise(input), (exercise) => {
      setExercises((items) => [...items, exercise].sort((a, b) => a.name.localeCompare(b.name)));
    }),
  };
}
