import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkoutExerciseInput, parseWorkoutRoutineInput, parseWorkoutSession } from './workout-contract';

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
    startedAt: 'today',
    finishedAt: null,
    updatedAt: 'today',
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
