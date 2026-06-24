import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWorkoutHistory, fetchWorkoutSession, finishWorkoutSession, logWorkoutSession, saveWorkoutSession, startWorkoutSessionFromRoutine } from './workout-api';
import type { WorkoutLoggedSessionInput, WorkoutSession } from '../../../shared/workout-contract';

const sampleSession: WorkoutSession = {
  id: 'session-1',
  routineId: null,
  name: 'Lift',
  startedAt: '2026-06-23T10:00:00.000Z',
  finishedAt: null,
  updatedAt: '2026-06-23T10:00:00.000Z',
  exercises: [],
};

const loggedSession: WorkoutLoggedSessionInput = {
  name: 'Lift',
  startedAt: '2026-06-23T10:00:00.000Z',
  finishedAt: '2026-06-23T11:00:00.000Z',
  exercises: [{ exerciseId: 'bench', sets: [{ reps: 8, weight: 185, completed: true }] }],
};

test('workout API starts routine sessions through the expected route', async () => {
  const originalFetch = globalThis.fetch;
  let url = '';
  let method = '';
  globalThis.fetch = async (input, init) => {
    url = String(input);
    method = String(init?.method ?? 'GET');
    return new Response(JSON.stringify({ item: sampleSession }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await startWorkoutSessionFromRoutine('routine-1');
    assert.equal(url, '/api/workout/sessions/from-routine/routine-1');
    assert.equal(method, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('workout API autosaves and finishes session payloads', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`);
    return new Response(JSON.stringify({ item: sampleSession }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await saveWorkoutSession(sampleSession);
    await finishWorkoutSession(sampleSession);
    assert.deepEqual(calls, [
      'PUT /api/workout/sessions/session-1',
      'POST /api/workout/sessions/session-1/finish',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('workout API reads history and session detail through the expected routes', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`);
    return String(input).includes('/history')
      ? new Response(JSON.stringify({ sessions: [{ id: 'session-1' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response(JSON.stringify({ item: sampleSession }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const history = await fetchWorkoutHistory({ limit: 5, query: 'bench', exerciseId: 'bench' });
    const session = await fetchWorkoutSession('session-1');
    assert.equal(history.length, 1);
    assert.equal(session.id, 'session-1');
    assert.deepEqual(calls, [
      'GET /api/workout/history?limit=5&query=bench&exerciseId=bench',
      'GET /api/workout/sessions/session-1',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('workout API logs completed sessions through the expected route', async () => {
  const originalFetch = globalThis.fetch;
  let call = '';
  let body = '';
  globalThis.fetch = async (input, init) => {
    call = `${init?.method ?? 'GET'} ${input}`;
    body = String(init?.body ?? '');
    return new Response(JSON.stringify({ item: sampleSession }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await logWorkoutSession(loggedSession);
    assert.equal(call, 'POST /api/workout/sessions/log');
    assert.match(body, /"exerciseId":"bench"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
