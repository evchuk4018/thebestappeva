import assert from 'node:assert/strict';
import test from 'node:test';
import { PythonExecSessionManager } from './python-exec-sessions';
import type { PythonExecBackend, PythonExecRawResult, PythonExecSession } from './python-exec-backend';

interface FakeSession extends PythonExecSession {
  killed: boolean;
  resetCount: number;
  aliveValue: boolean;
}

function createFakeSession(chatId: string, alive = true): FakeSession {
  const session: FakeSession = {
    chatId,
    killed: false,
    resetCount: 0,
    aliveValue: alive,
    get alive() {
      return this.aliveValue;
    },
    async exec(): Promise<PythonExecRawResult> {
      return { ok: true, exitCode: 0, stdout: '', stderr: '', durationMs: 1, stdoutTruncated: false, stderrTruncated: false };
    },
    async reset() {
      this.resetCount += 1;
    },
    async kill() {
      this.killed = true;
      this.aliveValue = false;
    },
  };
  return session;
}

function createFakeBackend(sessions: Map<string, FakeSession>, aliveOnCreate = true): PythonExecBackend {
  return {
    available: true,
    async openSession(chatId: string): Promise<PythonExecSession> {
      const session = createFakeSession(chatId, aliveOnCreate);
      sessions.set(chatId, session);
      return session;
    },
  };
}

test('acquire reuses an alive session for the same chat', async () => {
  const sessions = new Map<string, FakeSession>();
  const manager = new PythonExecSessionManager({ backend: createFakeBackend(sessions), idleMs: 100000 });
  const first = await manager.acquire('chat-a', '/work/a', '/inputs/a');
  const second = await manager.acquire('chat-a', '/work/a', '/inputs/a');
  assert.equal(first.session, second.session);
  assert.equal(second.recovered, false);
  assert.equal(manager.count(), 1);
});

test('acquire recreates a crashed session and marks it recovered', async () => {
  const sessions = new Map<string, FakeSession>();
  const manager = new PythonExecSessionManager({ backend: createFakeBackend(sessions), idleMs: 100000 });
  const first = await manager.acquire('chat-b', '/work/b', '/inputs/b');
  const crashed = sessions.get('chat-b')!;
  crashed.aliveValue = false;
  const second = await manager.acquire('chat-b', '/work/b', '/inputs/b');
  assert.notEqual(first.session, second.session);
  assert.equal(second.recovered, true);
  assert.equal(crashed.killed, true);
});

test('evict removes and kills the session', async () => {
  const sessions = new Map<string, FakeSession>();
  const manager = new PythonExecSessionManager({ backend: createFakeBackend(sessions), idleMs: 100000 });
  await manager.acquire('chat-c', '/work/c', '/inputs/c');
  const session = sessions.get('chat-c')!;
  await manager.evict('chat-c');
  assert.equal(session.killed, true);
  assert.equal(manager.has('chat-c'), false);
});

test('idle sessions are evicted after the idle window', async () => {
  const sessions = new Map<string, FakeSession>();
  let now = 1000;
  const manager = new PythonExecSessionManager({ backend: createFakeBackend(sessions), idleMs: 50, now: () => now });
  await manager.acquire('chat-d', '/work/d', '/inputs/d');
  const session = sessions.get('chat-d')!;
  assert.equal(session.killed, false);
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(manager.has('chat-d'), false);
  assert.equal(session.killed, true);
});

test('different chats get isolated sessions', async () => {
  const sessions = new Map<string, FakeSession>();
  const manager = new PythonExecSessionManager({ backend: createFakeBackend(sessions), idleMs: 100000 });
  const a = await manager.acquire('chat-x', '/work/x', '/inputs/x');
  const b = await manager.acquire('chat-y', '/work/y', '/inputs/y');
  assert.notEqual(a.session, b.session);
  assert.equal(manager.count(), 2);
});