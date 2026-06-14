import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewChat, createUserMessage } from './helpers';
import { ToolRegistryEntry } from './tools/types';
import { resolveThinkingTurn } from './thinking-turn';

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

function createThinkingEvent(delta: string, snapshot: string, model = 'qwen') {
  return JSON.stringify({ type: 'thinking', delta, snapshot, model });
}

function createContentEvent(delta: string, snapshot: string, model = 'qwen') {
  return JSON.stringify({ type: 'content', delta, snapshot, model });
}

function createToolCallsEvent(toolCalls: Array<{ id: string; function: { name: string; arguments: Record<string, unknown> } }>, model = 'qwen') {
  return JSON.stringify({ type: 'tool-calls', toolCalls, model });
}

function createDoneEvent(model = 'qwen') {
  return JSON.stringify({ type: 'done', model });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('streams thinking traces, tool steps, and the final answer', async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return createStreamResponse([
        createThinkingEvent('Inspect ', 'Inspect '),
        createToolCallsEvent([{ id: 'tool-1', function: { name: 'get_weather', arguments: { city: 'Boston' } } }]),
        createDoneEvent(),
      ]);
    }

    return createStreamResponse([
      createThinkingEvent('Summarize ', 'Summarize '),
      createContentEvent('Final ', 'Final '),
      createContentEvent('answer', 'Final answer'),
      createDoneEvent(),
    ]);
  };

  const toolEntry: ToolRegistryEntry = {
    definition: {
      id: 'weather',
      label: 'Weather',
      alias: '/weather',
      description: 'Weather lookup',
      enabledByDefault: true,
      functions: [{ name: 'get_weather', description: 'Get weather', parameters: [] }],
    },
    execute: async (invocation) => ({
      toolId: 'weather',
      functionName: invocation.functionName,
      ok: true,
      summary: '72F and sunny.',
      data: { temperature: 72 },
    }),
  };

  const progressSnapshots: string[] = [];
  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Weather?'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [toolEntry],
    onProgress: (chat) => {
      const assistant = [...chat.messages].reverse().find((message) => message.kind === 'assistant');
      progressSnapshots.push(assistant?.content ?? '');
    },
    promptContext: {
      generatedUserMemory: '',
      customPrompt: '',
      mode: 'thinking',
      tools: [toolEntry.definition],
    },
    resolveToolId: () => 'weather',
  });

  const assistant = result.chat.messages.at(-1);
  assert.equal(requestCount, 2);
  assert(assistant && assistant.kind === 'assistant');
  assert.equal(assistant.content, 'Final answer');
  assert.deepEqual(
    assistant.trace?.map((step) => step.kind),
    ['thinking', 'tool-call', 'tool-result', 'thinking'],
  );
  assert.equal(assistant.trace?.[0]?.kind === 'thinking' ? assistant.trace[0].content.trim() : '', 'Inspect');
  assert.equal(assistant.trace?.[3]?.kind === 'thinking' ? assistant.trace[3].content.trim() : '', 'Summarize');
  assert.equal(assistant.trace?.[2]?.kind === 'tool-result' ? assistant.trace[2].result.summary : '', '72F and sunny.');
  assert(progressSnapshots.includes('Final '));
  assert.equal(progressSnapshots.at(-1), 'Final answer');
});

test('preserves staged thinking blocks around tool work during long turns', async () => {
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return createStreamResponse([
        createThinkingEvent(
          'Tasks:\n1. Inspect the request.\n2. Gather the weather.\n3. Summarize the result.',
          'Tasks:\n1. Inspect the request.\n2. Gather the weather.\n3. Summarize the result.',
        ),
        createToolCallsEvent([{ id: 'tool-1', function: { name: 'get_weather', arguments: { city: 'Boston' } } }]),
        createDoneEvent(),
      ]);
    }

    return createStreamResponse([
      createThinkingEvent(
        'Task 2 complete.\nWeather retrieved.\nNext: summarize for the user.',
        'Task 2 complete.\nWeather retrieved.\nNext: summarize for the user.',
      ),
      createContentEvent('Boston is 72F and sunny.', 'Boston is 72F and sunny.'),
      createDoneEvent(),
    ]);
  };

  const toolEntry: ToolRegistryEntry = {
    definition: {
      id: 'weather',
      label: 'Weather',
      alias: '/weather',
      description: 'Weather lookup',
      enabledByDefault: true,
      functions: [{ name: 'get_weather', description: 'Get weather', parameters: [] }],
    },
    execute: async (invocation) => ({
      toolId: 'weather',
      functionName: invocation.functionName,
      ok: true,
      summary: '72F and sunny.',
      data: { temperature: 72 },
    }),
  };

  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Walk through the weather lookup.'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [toolEntry],
    onProgress: () => {},
    promptContext: {
      generatedUserMemory: '',
      customPrompt: '',
      mode: 'thinking',
      tools: [toolEntry.definition],
    },
    resolveToolId: () => 'weather',
  });

  const assistant = result.chat.messages.at(-1);
  assert.equal(requestCount, 2);
  assert(assistant && assistant.kind === 'assistant');
  assert.equal(assistant.content, 'Boston is 72F and sunny.');
  assert.deepEqual(
    assistant.trace?.map((step) => step.kind),
    ['thinking', 'tool-call', 'tool-result', 'thinking'],
  );
  assert.equal(
    assistant.trace?.[0]?.kind === 'thinking' ? assistant.trace[0].content : '',
    'Tasks:\n1. Inspect the request.\n2. Gather the weather.\n3. Summarize the result.',
  );
  assert.equal(
    assistant.trace?.[3]?.kind === 'thinking' ? assistant.trace[3].content : '',
    'Task 2 complete.\nWeather retrieved.\nNext: summarize for the user.',
  );
});
