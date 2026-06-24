import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRoutine, WorkoutSession } from '../../../shared/workout-contract';
import { duplicateRoutineInput, getWorkoutFinishPrompt, hasRoutineStructureChanges, sessionToRoutineInput } from './workout-routine-utils';
import { moveSessionExercise } from './workout-session-utils';

const baseRoutine: WorkoutRoutine = {
  id: 'routine-1',
  name: 'Push',
  exerciseSummary: 'Bench Press, Shoulder Press',
  createdAt: '2026-06-23T00:00:00.000Z',
  updatedAt: '2026-06-23T00:00:00.000Z',
  exercises: [
    { id: 'rex-1', routineId: 'routine-1', exerciseId: 'bench', exerciseName: 'Bench Press', orderIndex: 0, targetSets: 4 },
    { id: 'rex-2', routineId: 'routine-1', exerciseId: 'press', exerciseName: 'Shoulder Press', orderIndex: 1, targetSets: 3 },
  ],
};

test('duplicates routines with incremented copy names and preserved payloads', () => {
  const duplicate = duplicateRoutineInput(baseRoutine, [baseRoutine, { ...baseRoutine, id: 'routine-2', name: 'Push Copy' }]);
  assert.equal(duplicate.name, 'Push Copy 2');
  assert.deepEqual(duplicate.exercises, [
    { exerciseId: 'bench', orderIndex: 0, targetSets: 4 },
    { exerciseId: 'press', orderIndex: 1, targetSets: 3 },
  ]);
});

test('reorders session exercises and renumbers their order indexes', () => {
  const session: WorkoutSession = {
    id: 'session-1',
    routineId: null,
    name: 'Upper',
    startedAt: '2026-06-23T00:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-06-23T00:00:00.000Z',
    exercises: [
      { id: 'sex-1', sessionId: 'session-1', exerciseId: 'bench', exerciseName: 'Bench Press', orderIndex: 0, notes: '', lastPerformedText: null, sets: [{ id: 'set-1', sessionExerciseId: 'sex-1', setIndex: 0, rir: null, reps: null, weight: null, completed: false }] },
      { id: 'sex-2', sessionId: 'session-1', exerciseId: 'row', exerciseName: 'Row', orderIndex: 1, notes: '', lastPerformedText: null, sets: [{ id: 'set-2', sessionExerciseId: 'sex-2', setIndex: 0, rir: null, reps: null, weight: null, completed: false }] },
    ],
  };

  const reordered = moveSessionExercise(session, 'sex-2', 'sex-1');
  assert.deepEqual(reordered.exercises.map((exercise) => ({ id: exercise.id, orderIndex: exercise.orderIndex })), [
    { id: 'sex-2', orderIndex: 0 },
    { id: 'sex-1', orderIndex: 1 },
  ]);
});

test('builds a routine input from the active session structure', () => {
  const routine = sessionToRoutineInput({
    ...baseSession(),
    name: 'Custom Upper',
    exercises: [
      makeSessionExercise('bench', 4),
      makeSessionExercise('row', 2),
    ],
  });
  assert.deepEqual(routine, {
    name: 'Custom Upper',
    exercises: [
      { exerciseId: 'bench', orderIndex: 0, targetSets: 4 },
      { exerciseId: 'row', orderIndex: 1, targetSets: 2 },
    ],
  });
});

test('detects routine structure changes from exercise order and set counts only', () => {
  assert.equal(hasRoutineStructureChanges(baseRoutineSession(), baseRoutine), false);
  assert.equal(hasRoutineStructureChanges({ ...baseRoutineSession(), name: 'Renamed Session' }, baseRoutine), false);
  assert.equal(hasRoutineStructureChanges(withUpdatedWeight(baseRoutineSession()), baseRoutine), false);
  assert.equal(hasRoutineStructureChanges({
    ...baseRoutineSession(),
    exercises: [makeSessionExercise('press', 3), makeSessionExercise('bench', 4)],
  }, baseRoutine), true);
  assert.equal(hasRoutineStructureChanges({
    ...baseRoutineSession(),
    exercises: [makeSessionExercise('bench', 5), makeSessionExercise('press', 3)],
  }, baseRoutine), true);
});

test('returns finish prompts only for changed routines or non-empty quick workouts', () => {
  assert.equal(getWorkoutFinishPrompt(baseRoutineSession(), [baseRoutine]), null);
  assert.deepEqual(getWorkoutFinishPrompt(withUpdatedWeight(baseRoutineSession()), [baseRoutine]), null);
  assert.deepEqual(getWorkoutFinishPrompt({
    ...baseRoutineSession(),
    exercises: [makeSessionExercise('bench', 3), makeSessionExercise('press', 3)],
  }, [baseRoutine]), { kind: 'routine-update', routine: baseRoutine });
  assert.deepEqual(getWorkoutFinishPrompt({
    ...baseSession(),
    exercises: [makeSessionExercise('bench', 3)],
  }, [baseRoutine]), { kind: 'save-routine' });
  assert.equal(getWorkoutFinishPrompt(baseSession(), [baseRoutine]), null);
});

function baseSession(): WorkoutSession {
  return {
    id: 'session-1',
    routineId: null,
    name: 'Upper',
    startedAt: '2026-06-23T00:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-06-23T00:00:00.000Z',
    exercises: [],
  };
}

function baseRoutineSession(): WorkoutSession {
  return {
    ...baseSession(),
    routineId: 'routine-1',
    name: 'Push',
    exercises: [makeSessionExercise('bench', 4), makeSessionExercise('press', 3)],
  };
}

function makeSessionExercise(exerciseId: string, setCount: number) {
  return {
    id: `sex-${exerciseId}`,
    sessionId: 'session-1',
    exerciseId,
    exerciseName: exerciseId,
    orderIndex: 0,
    notes: '',
    lastPerformedText: null,
    sets: Array.from({ length: setCount }, (_, index) => ({
      id: `set-${exerciseId}-${index}`,
      sessionExerciseId: `sex-${exerciseId}`,
      setIndex: index,
      rir: 2,
      reps: 8,
      weight: 185,
      completed: true,
    })),
  };
}

function withUpdatedWeight(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({ ...set, weight: (set.weight ?? 0) + 5 })),
    })),
  };
}
