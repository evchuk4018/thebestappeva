import assert from 'node:assert/strict';
import test from 'node:test';
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
