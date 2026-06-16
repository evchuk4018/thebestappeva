import assert from 'node:assert/strict';
import test from 'node:test';
import { createAutoMemoryRefreshQueue } from './auto-memory-refresh-queue';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test('two rapid completed turns enqueue jobs and run them one at a time', async () => {
  const starts: string[] = [];
  const deferreds = new Map<string, ReturnType<typeof createDeferred<void>>>();
  const queue = createAutoMemoryRefreshQueue({
    execute: async (chatId) => {
      starts.push(chatId);
      const deferred = createDeferred<void>();
      deferreds.set(chatId, deferred);
      await deferred.promise;
    },
  });

  queue.enqueue('chat-1');
  queue.enqueue('chat-2');
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1']);

  deferreds.get('chat-1')?.resolve();
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1', 'chat-2']);

  deferreds.get('chat-2')?.resolve();
  await flushMicrotasks();
  queue.dispose();
});

test('repeated queued refreshes for one chat collapse to the latest pending job', async () => {
  const starts: string[] = [];
  const deferreds = new Map<string, ReturnType<typeof createDeferred<void>>>();
  const queue = createAutoMemoryRefreshQueue({
    execute: async (chatId) => {
      starts.push(chatId);
      const deferred = createDeferred<void>();
      deferreds.set(`${chatId}-${starts.length}`, deferred);
      await deferred.promise;
    },
  });

  queue.enqueue('chat-1');
  await flushMicrotasks();
  queue.enqueue('chat-2');
  queue.enqueue('chat-1');
  queue.enqueue('chat-1');

  deferreds.get('chat-1-1')?.resolve();
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1', 'chat-2']);

  deferreds.get('chat-2-2')?.resolve();
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1', 'chat-2', 'chat-1']);

  deferreds.get('chat-1-3')?.resolve();
  await flushMicrotasks();
  queue.dispose();
});

test('text-only foreground turns do not pause queue execution', async () => {
  const starts: string[] = [];
  const deferreds = new Map<string, ReturnType<typeof createDeferred<void>>>();
  const queue = createAutoMemoryRefreshQueue({
    execute: async (chatId) => {
      starts.push(chatId);
      const deferred = createDeferred<void>();
      deferreds.set(chatId, deferred);
      await deferred.promise;
    },
  });

  queue.enqueue('chat-1');
  await flushMicrotasks();
  queue.startForegroundTurn(false);
  queue.enqueue('chat-2');
  deferreds.get('chat-1')?.resolve();
  await flushMicrotasks();

  assert.deepEqual(starts, ['chat-1', 'chat-2']);
  deferreds.get('chat-2')?.resolve();
  queue.finishForegroundTurn(false);
  await flushMicrotasks();
  queue.dispose();
});

test('image-bearing foreground turns pause queued work and re-enqueue an in-flight refresh', async () => {
  const starts: string[] = [];
  const queue = createAutoMemoryRefreshQueue({
    execute: async (chatId, signal) => {
      starts.push(chatId);
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  });

  queue.enqueue('chat-1');
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1']);

  queue.startForegroundTurn(true);
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1']);

  queue.finishForegroundTurn(true);
  await flushMicrotasks();
  assert.deepEqual(starts, ['chat-1', 'chat-1']);
  queue.dispose();
});
