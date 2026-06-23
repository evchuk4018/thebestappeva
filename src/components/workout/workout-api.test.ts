import assert from 'node:assert/strict';
import test from 'node:test';
import { finishWorkoutSession, saveWorkoutSession, startWorkoutSessionFromRoutine } from './workout-api';
import type { WorkoutSession } from '../../../shared/workout-contract';

const sampleSession: WorkoutSession = {
  id: 'session-1',
  routineId: null,
  name: 'Lift',
  startedAt: '2026-06-23T10:00:00.000Z',
  finishedAt: null,
  updatedAt: '2026-06-23T10:00:00.000Z',
  exercises: [],
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
