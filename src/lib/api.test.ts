import assert from 'node:assert/strict';
import test from 'node:test';
import { registerApiAuthBridge, resetApiAuthBridgeForTests } from './api-auth';
import { ApiError, requestJson, resolveApiAssetUrl, resolveApiUrl, streamJsonLines } from './api';
import { resetAppConfigForTests, setAppConfigForTests } from './app-config';

const originalFetch = globalThis.fetch;

function createStreamResponse(lines: string[]) {
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(new TextEncoder().encode(`${line}\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  resetApiAuthBridgeForTests();
  resetAppConfigForTests();
});

test('resolves offline and hosted API base URLs through app config', () => {
  assert.equal(resolveApiUrl('/docs', { cursor: 'v1' }), '/api/docs?cursor=v1');
  assert.equal(resolveApiAssetUrl('/api/ai/chats/chat-1/python-exec/files/chart.png'), '/api/ai/chats/chat-1/python-exec/files/chart.png');

  setAppConfigForTests({ apiBaseUrl: 'https://example.com/api' });
  assert.equal(resolveApiUrl('/docs', { cursor: 'v2' }), 'https://example.com/api/docs?cursor=v2');
  assert.equal(resolveApiAssetUrl('/api/ai/chats/chat-1/python-exec/files/chart.png'), 'https://example.com/api/ai/chats/chat-1/python-exec/files/chart.png');
});

test('requestJson standardizes JSON API errors', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Rate limited.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });

  await assert.rejects(
    () => requestJson('/ai/runtime-config'),
    (error: unknown) => error instanceof ApiError && error.message === 'Rate limited.' && error.status === 429,
  );
});

test('streamJsonLines resolves hosted requests and streams NDJSON payloads', async () => {
  setAppConfigForTests({ apiBaseUrl: 'https://example.com/api' });

  const calls: Array<{ input: string; signal: AbortSignal | null }> = [];
  const controller = new AbortController();
  const chunks: Array<{ type: string; value: string }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), signal: (init?.signal as AbortSignal | undefined) ?? null });
    return createStreamResponse([
      JSON.stringify({ type: 'thinking', value: 'plan' }),
      JSON.stringify({ type: 'content', value: 'hello' }),
    ]);
  };

  await streamJsonLines<{ type: string; value: string }>('/ai/chat/stream', (chunk) => {
    chunks.push(chunk);
  }, { signal: controller.signal });

  assert.deepEqual(calls, [{ input: 'https://example.com/api/ai/chat/stream', signal: controller.signal }]);
  assert.deepEqual(chunks, [
    { type: 'thinking', value: 'plan' },
    { type: 'content', value: 'hello' },
  ]);
});

test('streamJsonLines preserves abort errors', async () => {
  const controller = new AbortController();
  globalThis.fetch = async () => {
    throw new DOMException('Stopped', 'AbortError');
  };

  await assert.rejects(
    () => streamJsonLines('/ai/chat/stream', () => undefined, { signal: controller.signal }),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );
});

test('requestJson attaches the latest bearer token and preserves caller headers', async () => {
  registerApiAuthBridge({
    getAccessToken: async () => 'token-123',
  });

  let authorization = '';
  let customHeader = '';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('Authorization') ?? '';
    customHeader = new Headers(init?.headers).get('x-client') ?? '';
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  await requestJson('/ai/runtime-config', { headers: { 'x-client': 'present' } });

  assert.equal(authorization, 'Bearer token-123');
  assert.equal(customHeader, 'present');
});

test('requestJson skips bearer attachment when unauthenticated', async () => {
  registerApiAuthBridge({
    getAccessToken: async () => null,
  });

  let authorization: string | null = 'sentinel';
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get('Authorization');
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  await requestJson('/ai/runtime-config');

  assert.equal(authorization, null);
});

test('requestJson refreshes once and retries one unauthorized response', async () => {
  const calls: string[] = [];
  let refreshCalls = 0;
  let authFailures = 0;
  registerApiAuthBridge({
    getAccessToken: async () => 'expired-token',
    refreshAccessToken: async () => {
      refreshCalls += 1;
      return 'fresh-token';
    },
    onAuthFailure: async () => {
      authFailures += 1;
    },
  });

  globalThis.fetch = async (_input, init) => {
    calls.push(new Headers(init?.headers).get('Authorization') ?? '');
    if (calls.length === 1) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentication required.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  await requestJson('/ai/runtime-config');

  assert.deepEqual(calls, ['Bearer expired-token', 'Bearer fresh-token']);
  assert.equal(refreshCalls, 1);
  assert.equal(authFailures, 0);
});

test('requestJson does not refresh or retry when authorization is explicit', async () => {
  let fetchCalls = 0;
  let refreshCalls = 0;
  const failures: string[] = [];
  registerApiAuthBridge({
    refreshAccessToken: async () => {
      refreshCalls += 1;
      return 'fresh-token';
    },
    onAuthFailure: async (reason) => {
      failures.push(reason);
    },
  });

  globalThis.fetch = async (_input, init) => {
    fetchCalls += 1;
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer provided-token');
    return new Response(JSON.stringify({ ok: false, error: 'Authentication required.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  };

  await assert.rejects(
    () => requestJson('/auth/session', { headers: { Authorization: 'Bearer provided-token' } }),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );

  assert.equal(fetchCalls, 1);
  assert.equal(refreshCalls, 0);
  assert.deepEqual(failures, []);
});

test('requestJson marks the session invalid when refresh fails after a 401', async () => {
  const failures: string[] = [];
  registerApiAuthBridge({
    getAccessToken: async () => 'expired-token',
    refreshAccessToken: async () => null,
    onAuthFailure: async (reason) => {
      failures.push(reason);
    },
  });

  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response(JSON.stringify({ ok: false, error: 'Authentication required.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  };

  await assert.rejects(
    () => requestJson('/ai/runtime-config'),
    (error: unknown) => error instanceof ApiError && error.status === 401,
  );

  assert.equal(fetchCalls, 1);
  assert.deepEqual(failures, ['refresh-failed']);
});
