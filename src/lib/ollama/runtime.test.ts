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

test('streams thinking and content deltas in order', async () => {
  const events: Array<{ type: string; value?: string }> = [];
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({ model: 'qwen', message: { thinking: 'Plan ' } }),
    JSON.stringify({ model: 'qwen', message: { thinking: 'more', content: 'Hel' } }),
    JSON.stringify({ model: 'qwen', message: { content: 'lo' }, done: true }),
  ]);

  const reply = await streamChatWithModel('qwen', [], {
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

test('surfaces streamed tool calls', async () => {
  const events: string[] = [];
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({
      model: 'qwen',
      message: { tool_calls: [{ function: { name: 'get_weather', arguments: { city: 'Boston' } } }] },
      done: true,
    }),
  ]);

  const reply = await streamChatWithModel('qwen', [], {
    think: true,
    onEvent: (event) => events.push(event.type),
  });

  assert.deepEqual(events, ['tool-calls', 'done']);
  assert.deepEqual(reply.toolCalls, [{ function: { name: 'get_weather', arguments: { city: 'Boston' } } }]);
  assert.equal(reply.content, '');
});

test('surfaces streamed Ollama error events verbatim', async () => {
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({ model: 'qwen', error: 'failed to parse JSON: unexpected end of JSON input', done: true }),
  ]);

  await assert.rejects(
    () => streamChatWithModel('qwen', []),
    /failed to parse JSON: unexpected end of JSON input/i,
  );
});

test('retries truncated streamed tool calls without streaming', async () => {
  const requestStreams: boolean[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body)) as { stream: boolean };
    requestStreams.push(request.stream);
    if (request.stream) {
      return createStreamResponse([
        JSON.stringify({ model: 'qwen-tool-retry', message: { thinking: 'Drafting' } }),
        JSON.stringify({ error: 'failed to parse JSON: unexpected end of JSON input' }),
      ]);
    }

    return new Response(
      JSON.stringify({
        model: 'qwen-tool-retry',
        message: {
          thinking: 'Drafting',
          tool_calls: [{
            function: {
              name: 'create_artifact',
              arguments: { title: 'Story', type: 'story', content: 'Once upon a time.' },
            },
          }],
        },
        done: true,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  };

  const reply = await streamChatWithModel('qwen-tool-retry', [], {
    tools: [{
      type: 'function',
      function: {
        name: 'create_artifact',
        description: 'Create an artifact.',
        parameters: { type: 'object', properties: {} },
      },
    }],
  });

  assert.deepEqual(requestStreams, [true, false]);
  assert.equal(reply.toolCalls?.[0]?.function.name, 'create_artifact');
  assert.equal(reply.toolCalls?.[0]?.function.arguments.content, 'Once upon a time.');
});

test('remembers models that require non-streamed tool calls', async () => {
  let requestStream = true;
  globalThis.fetch = async (_input, init) => {
    requestStream = (JSON.parse(String(init?.body)) as { stream: boolean }).stream;
    return createStreamResponse([
      JSON.stringify({ model: 'qwen-tool-retry', message: { content: 'Finished' }, done: true }),
    ]);
  };

  const reply = await streamChatWithModel('qwen-tool-retry', [], {
    tools: [{
      type: 'function',
      function: {
        name: 'create_artifact',
        description: 'Create an artifact.',
        parameters: { type: 'object', properties: {} },
      },
    }],
  });

  assert.equal(requestStream, false);
  assert.equal(reply.content, 'Finished');
});

test('does not reclassify callback-thrown Ollama errors as invalid JSON', async () => {
  globalThis.fetch = async () => createStreamResponse([
    JSON.stringify({ model: 'qwen', message: { content: 'Hello' }, done: true }),
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
