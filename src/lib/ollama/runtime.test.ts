import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaClientError, streamChatWithModel } from './runtime';

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
});

test('streams provider-neutral thinking and content deltas in order', async () => {
  const events: Array<{ type: string; value?: string }> = [];
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({ type: 'thinking', delta: 'Plan ', snapshot: 'Plan ', model: 'qwen' }),
    JSON.stringify({ type: 'thinking', delta: 'more', snapshot: 'Plan more', model: 'qwen' }),
    JSON.stringify({ type: 'content', delta: 'Hel', snapshot: 'Hel', model: 'qwen' }),
    JSON.stringify({ type: 'content', delta: 'lo', snapshot: 'Hello', model: 'qwen' }),
    JSON.stringify({ type: 'done', model: 'qwen' }),
  ]);

  const reply = await streamChatWithModel('qwen', [], {
    provider: 'ollama',
    think: true,
    onEvent: (event) => {
      if (event.type === 'thinking' || event.type === 'content') {
        events.push({ type: event.type, value: event.snapshot });
        return;
      }

      events.push({ type: event.type });
    },
  });

  assert.deepEqual(events, [
    { type: 'thinking', value: 'Plan ' },
    { type: 'thinking', value: 'Plan more' },
    { type: 'content', value: 'Hel' },
    { type: 'content', value: 'Hello' },
    { type: 'done' },
  ]);
  assert.equal(reply.thinking, 'Plan more');
  assert.equal(reply.content, 'Hello');
});

test('passes the selected provider to the local AI server', async () => {
  let requestBody: { provider?: string } | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as { provider?: string };
    return createStreamResponse([JSON.stringify({ type: 'done', model: 'deepseek-v4-flash' })]);
  };

  await streamChatWithModel('deepseek-v4-flash', [], { provider: 'deepseek' });
  assert.equal(requestBody?.provider, 'deepseek');
});

test('surfaces streamed tool calls', async () => {
  const events: string[] = [];
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({
      type: 'tool-calls',
      toolCalls: [{ id: 'tool-1', function: { name: 'get_weather', arguments: { city: 'Boston' } } }],
      model: 'qwen',
    }),
    JSON.stringify({ type: 'done', model: 'qwen' }),
  ]);

  const reply = await streamChatWithModel('qwen', [], {
    think: true,
    onEvent: (event) => events.push(event.type),
  });

  assert.deepEqual(events, ['tool-calls', 'done']);
  assert.deepEqual(reply.toolCalls, [{ id: 'tool-1', function: { name: 'get_weather', arguments: { city: 'Boston' } } }]);
  assert.equal(reply.content, '');
});

test('surfaces streamed local AI server error events verbatim', async () => {
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({ type: 'error', error: 'DeepSeek provider selected but DEEPSEEK_API_KEY is not set.' }),
  ]);

  await assert.rejects(
    () => streamChatWithModel('deepseek-v4-flash', [], { provider: 'deepseek' }),
    /DEEPSEEK_API_KEY is not set/i,
  );
});

test('does not reclassify callback-thrown runtime errors as invalid JSON', async () => {
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({ type: 'content', delta: 'Hello', snapshot: 'Hello', model: 'qwen' }),
    JSON.stringify({ type: 'done', model: 'qwen' }),
  ]);

  const callbackError = new OllamaClientError('Tool event callback failed.', 'response');
  await assert.rejects(
    () =>
      streamChatWithModel('qwen', [], {
        onEvent: (event) => {
          if (event.type === 'content') {
            throw callbackError;
          }
        },
      }),
    (error: unknown) => error === callbackError,
  );
});

test('rejects malformed stream payloads', async () => {
  globalThis.fetch = async () => createStreamResponse(['{bad json']);
  await assert.rejects(() => streamChatWithModel('qwen', []), /invalid JSON/i);
});

test('rethrows abort errors', async () => {
  globalThis.fetch = async () => {
    throw new DOMException('Stopped', 'AbortError');
  };

  await assert.rejects(
    () => streamChatWithModel('qwen', []),
    (error: unknown) => error instanceof DOMException && error.name === 'AbortError',
  );
});
