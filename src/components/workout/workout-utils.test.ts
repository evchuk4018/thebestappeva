import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkoutRoutine, WorkoutSession } from '../../../shared/workout-contract';
import { duplicateRoutineInput } from './workout-routine-utils';
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
