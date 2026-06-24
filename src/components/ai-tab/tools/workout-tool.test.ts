import assert from 'node:assert/strict';
import test from 'node:test';
import { getToolRegistryEntries } from './registry';
import { workoutTool } from './workout-tool';

function invocation(functionName: string, args: Record<string, unknown> = {}) {
  return { toolId: 'workout', functionName, args, createdAt: '2026-06-23T00:00:00.000Z' };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

function withMockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => handler(String(input), init);
  return () => { globalThis.fetch = original; };
}

async function run(functionName: string, args: Record<string, unknown> = {}) {
  const result = await workoutTool.execute(invocation(functionName, args), {});
  assert.equal('deferred' in result, false);
  if ('deferred' in result) throw new Error('workout tool should not defer');
  return result;
}

const sampleSession = {
  id: 'session-1',
  routineId: null,
  name: 'Push Day',
  startedAt: '2026-06-23T10:00:00.000Z',
  finishedAt: null,
  updatedAt: '2026-06-23T10:00:00.000Z',
  exercises: [],
};

test('workout tool is registered and enabled by default', () => {
  const entry = getToolRegistryEntries().find((candidate) => candidate.definition.id === 'workout');
  assert.equal(entry?.definition.alias, '/workout');
  assert.equal(entry?.definition.enabledByDefault, true);
});

test('get_workout_overview and search_workout_exercises read bootstrap data', async () => {
  const restore = withMockFetch((url) => {
    assert.equal(url, '/api/workout/bootstrap');
    return json({
      exercises: [{ id: 'bench', name: 'Bench Press', category: 'Chest', equipment: 'Barbell' }],
      routines: [{ id: 'routine-1', name: 'Push Day' }],
      activeSession: null,
    });
  });
  try {
    const overview = await run('get_workout_overview');
    const search = await run('search_workout_exercises', { query: 'bench' });
    assert.equal((overview.data?.exercises as unknown[]).length, 1);
    assert.equal((search.data?.exercises as unknown[]).length, 1);
  } finally {
    restore();
  }
});

test('workout tool routine and exercise mutations hit the expected routes', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url === '/api/workout/exercises') return json({ item: { id: 'ex-1', name: 'JM Press' } });
    if (init?.method === 'DELETE') return json({ ok: true });
    return json({ item: { id: 'routine-1', name: 'Push Day' } });
  });
  try {
    await run('create_workout_exercise', { name: 'JM Press' });
    await run('create_workout_routine', { routine: { name: 'Push Day', exercises: [{ exerciseId: 'bench', targetSets: 4 }] } });
    await run('update_workout_routine', { routineId: 'routine-1', routine: { name: 'Push Day 2', exercises: [{ exerciseId: 'bench', targetSets: 3 }] } });
    await run('delete_workout_routine', { routineId: 'routine-1' });
    assert.deepEqual(calls, [
      'POST /api/workout/exercises',
      'POST /api/workout/routines',
      'PUT /api/workout/routines/routine-1',
      'DELETE /api/workout/routines/routine-1',
    ]);
  } finally {
    restore();
  }
});

test('workout tool session and history functions hit the expected routes', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/history')) return json({ sessions: [{ id: 'session-9', name: 'Past Lift' }] });
    if (init?.method === 'DELETE') return json({ ok: true });
    return json({ item: sampleSession });
  });
  try {
    await run('start_empty_workout_session');
    await run('start_routine_workout_session', { routineId: 'routine-1' });
    await run('update_workout_session', { session: sampleSession });
    await run('finish_workout_session', { session: sampleSession });
    await run('cancel_workout_session', { sessionId: 'session-1' });
    await run('list_past_workouts', { query: 'push', exerciseId: 'bench', limit: 5 });
    await run('get_workout_session', { sessionId: 'session-9' });
    await run('log_completed_workout', {
      session: {
        name: 'Logged Lift',
        startedAt: '2026-06-23T08:00:00.000Z',
        finishedAt: '2026-06-23T09:00:00.000Z',
        exercises: [{ exerciseId: 'bench', sets: [{ reps: 8, weight: 185, completed: true }] }],
      },
    });
    assert.deepEqual(calls, [
      'POST /api/workout/sessions/empty',
      'POST /api/workout/sessions/from-routine/routine-1',
      'PUT /api/workout/sessions/session-1',
      'POST /api/workout/sessions/session-1/finish',
      'DELETE /api/workout/sessions/session-1',
      'GET /api/workout/history?limit=5&query=push&exerciseId=bench',
      'GET /api/workout/sessions/session-9',
      'POST /api/workout/sessions/log',
    ]);
  } finally {
    restore();
  }
});

test('workout tool validates required fields and timestamps', async () => {
  assert.equal((await run('create_workout_exercise', { category: 'Arms' })).ok, false);
  assert.equal((await run('update_workout_routine', { routineId: 'routine-1' })).ok, false);
  assert.equal((await run('log_completed_workout', {
    session: {
      name: 'Bad Lift',
      startedAt: '2026-06-23T09:00:00.000Z',
      finishedAt: '2026-06-23T08:00:00.000Z',
      exercises: [],
    },
  })).ok, false);
});
