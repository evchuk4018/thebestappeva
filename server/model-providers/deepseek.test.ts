import assert from 'node:assert/strict';
import test from 'node:test';
import { serverConfig } from '../config';
import {
  applyDeepSeekToolCallDeltas,
  finalizeDeepSeekToolCalls,
  tryFinalizeDeepSeekToolCalls,
} from './stream-parsers';

const originalFetch = globalThis.fetch;
const originalDeepSeekApiKey = serverConfig.deepseekApiKey;
const originalDeepSeekBaseUrl = serverConfig.deepseekBaseUrl;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

function sseResponse(events: unknown[]) {
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  serverConfig.deepseekApiKey = originalDeepSeekApiKey;
  serverConfig.deepseekBaseUrl = originalDeepSeekBaseUrl;
});

test('DeepSeek status loads supported V4 models from /models without leaking the API key', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';

  globalThis.fetch = async () => jsonResponse({
    object: 'list',
    data: [
      { id: 'deepseek-v4-flash' },
      { id: 'deepseek-v4-pro' },
      { id: 'ignored-model' },
    ],
  });

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const status = await provider.getStatus();

  assert.equal(status.option.configured, true);
  assert.equal(status.option.status, 'ready');
  assert.equal(status.option.defaultModel, 'deepseek-v4-flash');
  assert.equal(status.option.defaultModelLabel, 'DeepSeek V4 Flash');
  assert.deepEqual(status.models.map((model) => model.name), ['deepseek-v4-flash', 'deepseek-v4-pro']);
  assert.doesNotMatch(JSON.stringify(status), /super-secret-key/);
});

test('DeepSeek status reports the endpoint as unavailable when model discovery fails', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';

  globalThis.fetch = async () => jsonResponse({ error: 'Service unavailable' }, { status: 503 });

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const status = await provider.getStatus();

  assert.equal(status.option.status, 'unavailable');
  assert.match(status.option.detail, /service unavailable/i);
  assert.equal(status.models.length, 0);
});

test('DeepSeek requests explicitly disable thinking when think is false', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';

  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({
      model: 'deepseek-v4-flash',
      choices: [{ message: { content: 'ok' } }],
    });
  };

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  await provider.callChatStream({
    model: 'deepseek-v4-flash',
    messages: [{ role: 'user', content: 'hi' }],
    think: false,
  });

  assert.deepEqual(requestBody?.thinking, { type: 'disabled' });
});

test('DeepSeek tool deltas stay silent until the accumulated arguments parse successfully', () => {
  const pending = applyDeepSeekToolCallDeltas([], [
    { index: 0, id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{"limit":' } },
  ]);

  assert.equal(tryFinalizeDeepSeekToolCalls(pending), undefined);

  applyDeepSeekToolCallDeltas(pending, [
    { index: 0, function: { arguments: ' 3}' } },
  ]);

  assert.deepEqual(tryFinalizeDeepSeekToolCalls(pending), [
    { id: 'tool-1', function: { name: 'list_recent_chats', arguments: { limit: 3 } } },
  ]);
});

test('DeepSeek tool finalization treats blank arguments as an empty object', () => {
  assert.deepEqual(
    finalizeDeepSeekToolCalls([{ id: 'tool-1', function: { name: 'list_recent_chats', arguments: '   ' } }]),
    [{ id: 'tool-1', function: { name: 'list_recent_chats', arguments: {} } }],
  );
});

test('DeepSeek tool finalization still rejects invalid final JSON', () => {
  assert.throws(
    () => finalizeDeepSeekToolCalls([{ id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{"limit":' } }]),
    /invalid tool arguments/i,
  );
});

test('DeepSeek streaming waits for complete tool arguments before surfacing tool calls', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';
  const model = 'deepseek-v4-stream-test';
  globalThis.fetch = async () => sseResponse([
    {
      model,
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{"limit":' } }] } }],
    },
    {
      model,
      choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: ' 2}' } }] } }],
    },
  ]);

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const events: string[] = [];
  const reply = await provider.callChatStream({
    model,
    messages: [{ role: 'user', content: 'recent chats?' }],
    tools: [{ type: 'function', function: { name: 'list_recent_chats', description: 'List chats', parameters: { type: 'object', properties: {} } } }],
    onEvent: (event) => events.push(event.type),
  });

  assert.deepEqual(events, ['tool-calls']);
  assert.deepEqual(reply.toolCalls, [
    { id: 'tool-1', function: { name: 'list_recent_chats', arguments: { limit: 2 } } },
  ]);
});

test('DeepSeek retries malformed streamed tool arguments once without streaming', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';
  const model = 'deepseek-v4-retry-test';
  const requestBodies: Array<{ stream?: boolean }> = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as { stream?: boolean });
    return requestBodies.length === 1
      ? sseResponse([
          {
            model,
            choices: [{ delta: { tool_calls: [{ index: 0, id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{"limit":' } }] } }],
          },
        ])
      : jsonResponse({
          model,
          choices: [{ message: { tool_calls: [{ id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{"limit":5}' } }] } }],
        });
  };

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const reply = await provider.callChatStream({
    model,
    messages: [{ role: 'user', content: 'recent chats?' }],
    tools: [{ type: 'function', function: { name: 'list_recent_chats', description: 'List chats', parameters: { type: 'object', properties: {} } } }],
  });

  assert.deepEqual(requestBodies.map((body) => body.stream), [true, false]);
  assert.deepEqual(reply.toolCalls, [
    { id: 'tool-1', function: { name: 'list_recent_chats', arguments: { limit: 5 } } },
  ]);
});

test('DeepSeek remembers tool-enabled models that require non-streamed retries', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';
  const model = 'deepseek-v4-memory-test';
  const requestBodies: Array<{ stream?: boolean }> = [];
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as { stream?: boolean });
    if (requestBodies.length === 1) {
      return sseResponse([
        {
          model,
          choices: [{ delta: { tool_calls: [{ index: 0, id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{"limit":' } }] } }],
        },
      ]);
    }

    return jsonResponse({
      model,
      choices: [{ message: { content: 'ok', tool_calls: [{ id: 'tool-1', function: { name: 'list_recent_chats', arguments: '{}' } }] } }],
    });
  };

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const toolOptions = {
    model,
    messages: [{ role: 'user' as const, content: 'recent chats?' }],
    tools: [{ type: 'function' as const, function: { name: 'list_recent_chats', description: 'List chats', parameters: { type: 'object' as const, properties: {} } } }],
  };

  await provider.callChatStream(toolOptions);
  await provider.callChatStream(toolOptions);
  await provider.callChatStream({
    model,
    messages: [{ role: 'user', content: 'say hi' }],
  });

  assert.deepEqual(requestBodies.map((body) => body.stream), [true, false, false, true]);
});
