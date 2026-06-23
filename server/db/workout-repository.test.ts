import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createWorkoutRepository } from './workout-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  return { database, repository: createWorkoutRepository(database) };
}

test('creates workout schema and seeds presets idempotently', () => {
  const { database, repository } = createTestRepository();
  repository.ensureDefaults();
  repository.ensureDefaults();
  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'workout_%' ORDER BY name`).all() as Array<{ name: string }>;
  const exerciseCount = repository.listExercises().length;
  assert.deepEqual(tables.map((entry) => entry.name), [
    'workout_exercises',
    'workout_routine_exercises',
    'workout_routines',
    'workout_session_exercises',
    'workout_sessions',
    'workout_sets',
  ]);
  assert.ok(exerciseCount > 50);
  assert.equal(repository.listExercises().length, exerciseCount);
});

test('creates routines and starts reusable active sessions', () => {
  const { repository } = createTestRepository();
  const exercises = repository.bootstrap().exercises.slice(0, 2);
  const routine = repository.saveRoutine(null, {
    name: 'Test Routine',
    exercises: exercises.map((exercise, index) => ({ exerciseId: exercise.id, orderIndex: index, targetSets: 2 })),
  });
  const session = repository.startRoutineSession(routine.id);
  assert.equal(session?.name, 'Test Routine');
  assert.equal(session?.exercises.length, 2);
  assert.equal(session?.exercises[0].sets.length, 2);
  assert.equal(repository.startEmptySession().id, session?.id);
});

test('finishes sessions and exposes previous set hints', () => {
  const { repository } = createTestRepository();
  const exercise = repository.bootstrap().exercises[0];
  let session = repository.startEmptySession();
  session.exercises = [{
    id: 'sex-a',
    sessionId: session.id,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    orderIndex: 0,
    notes: '',
    lastPerformedText: null,
    sets: [{ id: 'set-a', sessionExerciseId: 'sex-a', setIndex: 0, rir: 2, reps: 8, weight: 135, completed: true }],
  }];
  repository.finishSession(session);

  const next = repository.startEmptySession();
  next.exercises = [{ ...session.exercises[0], id: 'sex-b', sessionId: next.id, sets: [{ ...session.exercises[0].sets[0], id: 'set-b', sessionExerciseId: 'sex-b' }] }];
  const saved = repository.saveSession(next);
  assert.match(saved?.exercises[0].lastPerformedText ?? '', /135 x 8/);
});
