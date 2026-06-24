import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createWorkoutRepository } from './workout-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  let currentNow = '2026-06-23T12:00:00.000Z';
  return {
    database,
    repository: createWorkoutRepository(database, () => currentNow),
    setNow(next: string) { currentNow = next; },
  };
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

test('lists finished workout history and supports filters', () => {
  const { repository } = createTestRepository();
  const [bench, row] = repository.bootstrap().exercises;
  repository.logCompletedSession({
    name: 'Push Day',
    startedAt: '2026-06-23T10:00:00.000Z',
    finishedAt: '2026-06-23T11:00:00.000Z',
    exercises: [
      { exerciseId: bench.id, sets: [{ reps: 8, weight: 185, completed: true }] },
      { exerciseId: row.id, sets: [{ reps: 10, weight: 135, completed: true }] },
    ],
  });
  repository.logCompletedSession({
    name: 'Leg Day',
    startedAt: '2026-06-22T10:00:00.000Z',
    finishedAt: '2026-06-22T11:00:00.000Z',
    exercises: [{ exerciseId: row.id, sets: [{ reps: 12, weight: 90, completed: true }] }],
  });

  const all = repository.listFinishedSessions({ limit: 10 });
  const filteredByQuery = repository.listFinishedSessions({ query: 'push' });
  const filteredByExercise = repository.listFinishedSessions({ exerciseId: bench.id });

  assert.equal(all.length, 2);
  assert.deepEqual(all[0].exerciseNames, [bench.name, row.name]);
  assert.equal(all[0].completedSetCount, 2);
  assert.equal(filteredByQuery.length, 1);
  assert.equal(filteredByQuery[0].name, 'Push Day');
  assert.equal(filteredByExercise.length, 1);
  assert.equal(filteredByExercise[0].name, 'Push Day');
});

test('fetches saved sessions and preserves active session when logging history', () => {
  const { repository } = createTestRepository();
  const exercise = repository.bootstrap().exercises[0];
  const active = repository.startEmptySession();
  const logged = repository.logCompletedSession({
    name: 'Backfill',
    startedAt: '2026-06-20T10:00:00.000Z',
    finishedAt: '2026-06-20T11:00:00.000Z',
    exercises: [{ exerciseId: exercise.id, sets: [{ reps: 6, weight: 205, completed: true }] }],
  });

  assert.equal(repository.activeSession()?.id, active.id);
  assert.equal(repository.getSession(logged.id)?.finishedAt, '2026-06-20T11:00:00.000Z');
  assert.ok(logged.exercises[0].id.startsWith('sex_'));
  assert.ok(logged.exercises[0].sets[0].id.startsWith('set_'));
});

test('auto-finishes expired sessions at startedAt plus 24 hours', () => {
  const { repository, setNow } = createTestRepository();
  const active = repository.startEmptySession();
  setNow('2026-06-24T12:00:00.000Z');

  const bootstrap = repository.bootstrap();

  assert.equal(bootstrap.activeSession, null);
  const finished = repository.getSession(active.id);
  assert.equal(finished?.finishedAt, '2026-06-24T12:00:00.000Z');
  assert.equal(repository.listFinishedSessions({ limit: 10 }).some((session) => session.id === active.id), true);
});

test('starts a new session instead of resuming an expired one', () => {
  const { repository, setNow } = createTestRepository();
  const active = repository.startEmptySession();
  setNow('2026-06-24T12:00:00.000Z');

  const next = repository.startEmptySession();

  assert.notEqual(next.id, active.id);
  assert.equal(repository.getSession(active.id)?.finishedAt, '2026-06-24T12:00:00.000Z');
});

test('forces stale autosaves to keep the expiry finish time', () => {
  const { repository, setNow } = createTestRepository();
  const active = repository.startEmptySession();
  setNow('2026-06-24T12:00:00.000Z');
  active.name = 'Late Save';
  active.exercises = [{
    id: 'sex-late',
    sessionId: active.id,
    exerciseId: repository.bootstrap().exercises[0].id,
    exerciseName: 'Bench Press',
    orderIndex: 0,
    notes: 'late update',
    lastPerformedText: null,
    sets: [{ id: 'set-late', sessionExerciseId: 'sex-late', setIndex: 0, rir: 1, reps: 8, weight: 185, completed: true }],
  }];

  const saved = repository.saveSession(active);

  assert.equal(saved?.name, 'Late Save');
  assert.equal(saved?.finishedAt, '2026-06-24T12:00:00.000Z');
  assert.equal(saved?.exercises[0].notes, 'late update');
});
