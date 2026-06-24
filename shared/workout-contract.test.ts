import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkoutExerciseInput, parseWorkoutLoggedSessionInput, parseWorkoutRoutineInput, parseWorkoutSession } from './workout-contract';

test('parses workout exercise and routine inputs', () => {
  assert.deepEqual(parseWorkoutExerciseInput({ name: 'Sled Push' }), {
    name: 'Sled Push',
    category: 'Custom',
    equipment: 'Other',
  });

  const routine = parseWorkoutRoutineInput({
    name: 'Push',
    exercises: [{ exerciseId: 'ex_bench', targetSets: 4 }],
  });
  assert.equal(routine.name, 'Push');
  assert.equal(routine.exercises[0].targetSets, 4);
});

test('rejects invalid workout inputs', () => {
  assert.throws(() => parseWorkoutExerciseInput({ name: '' }), /name/);
  assert.throws(() => parseWorkoutRoutineInput({ name: 'Bad', exercises: [{}] }), /exerciseId/);
  assert.throws(() => parseWorkoutSession({
    id: 'session-1',
    routineId: null,
    name: 'Lift',
    startedAt: '2026-06-23T10:00:00.000Z',
    finishedAt: null,
    updatedAt: '2026-06-23T10:00:00.000Z',
    exercises: [{
      id: 'sex-1',
      sessionId: 'session-1',
      exerciseId: 'ex-1',
      exerciseName: 'Bench',
      orderIndex: 0,
      notes: '',
      sets: [{ id: 'set-1', sessionExerciseId: 'sex-1', setIndex: 0, rir: -1, reps: 5, weight: 100, completed: true }],
    }],
  }), /rir/);
});

test('parses logged workout sessions with server-generated ids deferred', () => {
  const session = parseWorkoutLoggedSessionInput({
    name: 'Push Day',
    startedAt: '2026-06-23T10:00:00.000Z',
    finishedAt: '2026-06-23T11:00:00.000Z',
    exercises: [{
      exerciseId: 'ex-bench',
      sets: [{ reps: 8, weight: 185, completed: true }],
    }],
  });
  assert.equal(session.exercises[0].orderIndex, 0);
  assert.equal(session.exercises[0].sets[0].setIndex, 0);
});

test('rejects invalid logged workout history payloads', () => {
  assert.throws(() => parseWorkoutLoggedSessionInput({
    name: 'Pull Day',
    startedAt: 'invalid',
    finishedAt: '2026-06-23T11:00:00.000Z',
    exercises: [],
  }), /startedAt/);
  assert.throws(() => parseWorkoutLoggedSessionInput({
    name: 'Leg Day',
    startedAt: '2026-06-23T11:00:00.000Z',
    finishedAt: '2026-06-23T10:00:00.000Z',
    exercises: [],
  }), /finishedAt/);
  assert.throws(() => parseWorkoutLoggedSessionInput({
    name: 'Upper',
    startedAt: '2026-06-23T10:00:00.000Z',
    finishedAt: '2026-06-23T11:00:00.000Z',
    exercises: [{ sets: [] }],
  }), /exerciseId/);
});
