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

test('retires a tool after three same-tool failures and completes without marking the turn as an error', async () => {
  const requestBodies: Array<{ messages: Array<{ content: string }>; tools?: Array<{ function: { name: string } }> }> = [];
  let requestCount = 0;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    requestCount += 1;
    if (requestCount <= 3) {
      return createStreamResponse([createToolCallsEvent([{ id: `tool-${requestCount}`, function: { name: 'get_weather', arguments: { city: 'Boston' } } }]), createDoneEvent()]);
    }
    return createStreamResponse([createContentEvent('Weather tool is down, so here is the limitation.', 'Weather tool is down, so here is the limitation.'), createDoneEvent()]);
  };

  const toolEntry: ToolRegistryEntry = {
    definition: { id: 'weather', label: 'Weather', alias: '/weather', description: 'Weather lookup', enabledByDefault: true, functions: [{ name: 'get_weather', description: 'Get weather', parameters: [] }] },
    execute: async () => ({ toolId: 'weather', functionName: 'get_weather', ok: false, summary: 'Weather service failed.', error: 'Weather service failed.' }),
  };

  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Weather?'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [toolEntry],
    onProgress: () => {},
    promptContext: { generatedUserMemory: '', customPrompt: '', mode: 'thinking', tools: [toolEntry.definition] },
    resolveToolId: () => 'weather',
  });

  const assistant = result.chat.messages.at(-1);
  assert.equal(result.availability, 'ready');
  assert.equal(result.lastError, 'The tool "weather" failed three times in a row and was disabled for the rest of this turn.');
  assert(assistant && assistant.kind === 'assistant');
  assert.equal(assistant.status, 'complete');
  assert.equal(assistant.content, 'Weather tool is down, so here is the limitation.');
  assert.equal(requestBodies[3]?.tools, undefined);
  assert.match(requestBodies[3]?.messages[0]?.content ?? '', /No tools are currently enabled for this turn/i);
  assert.doesNotMatch(requestBodies[3]?.messages[0]?.content ?? '', /Weather \(/);
  assert.match(assistant.trace?.[5]?.kind === 'tool-result' ? assistant.trace[5].result.summary : '', /temporarily unavailable for the rest of this turn/i);
});

test('keeps tools available when failures come from different tools', async () => {
  const requestBodies: Array<{ tools?: Array<{ function: { name: string } }> }> = [];
  let requestCount = 0;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    requestCount += 1;
    if (requestCount === 1) {
      return createStreamResponse([createToolCallsEvent([{ id: 'tool-1', function: { name: 'get_weather', arguments: { city: 'Boston' } } }]), createDoneEvent()]);
    }
    if (requestCount === 2) {
      return createStreamResponse([createToolCallsEvent([{ id: 'tool-2', function: { name: 'get_location', arguments: {} } }]), createDoneEvent()]);
    }
    return createStreamResponse([createContentEvent('I cannot reach either tool right now.', 'I cannot reach either tool right now.'), createDoneEvent()]);
  };

  const weatherTool: ToolRegistryEntry = {
    definition: { id: 'weather', label: 'Weather', alias: '/weather', description: 'Weather lookup', enabledByDefault: true, functions: [{ name: 'get_weather', description: 'Get weather', parameters: [] }] },
    execute: async () => ({ toolId: 'weather', functionName: 'get_weather', ok: false, summary: 'Weather service failed.', error: 'Weather service failed.' }),
  };
  const locationTool: ToolRegistryEntry = {
    definition: { id: 'location', label: 'Location', alias: '/location', description: 'Location lookup', enabledByDefault: true, functions: [{ name: 'get_location', description: 'Get location', parameters: [] }] },
    execute: async () => ({ toolId: 'location', functionName: 'get_location', ok: false, summary: 'Location service failed.', error: 'Location service failed.' }),
  };

  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Where am I and what is the weather?'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [weatherTool, locationTool],
    onProgress: () => {},
    promptContext: { generatedUserMemory: '', customPrompt: '', mode: 'thinking', tools: [weatherTool.definition, locationTool.definition] },
    resolveToolId: (name) => (name === 'get_weather' ? 'weather' : 'location'),
  });

  assert.equal(result.lastError, null);
  assert.equal(requestBodies[2]?.tools?.map((tool) => tool.function.name).join(','), 'get_weather,get_location');
});

test('resets the same-tool failure streak after a successful tool result', async () => {
  const requestBodies: Array<{ tools?: Array<{ function: { name: string } }> }> = [];
  let requestCount = 0;
  let executionCount = 0;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)));
    requestCount += 1;
    if (requestCount <= 5) {
      return createStreamResponse([createToolCallsEvent([{ id: `tool-${requestCount}`, function: { name: 'get_weather', arguments: { city: 'Boston' } } }]), createDoneEvent()]);
    }
    return createStreamResponse([createContentEvent('The retries were mixed, so the tool stayed available.', 'The retries were mixed, so the tool stayed available.'), createDoneEvent()]);
  };

  const toolEntry: ToolRegistryEntry = {
    definition: { id: 'weather', label: 'Weather', alias: '/weather', description: 'Weather lookup', enabledByDefault: true, functions: [{ name: 'get_weather', description: 'Get weather', parameters: [] }] },
    execute: async () => {
      executionCount += 1;
      return executionCount === 3
        ? { toolId: 'weather', functionName: 'get_weather', ok: true, summary: '72F and sunny.', data: { temperature: 72 } }
        : { toolId: 'weather', functionName: 'get_weather', ok: false, summary: 'Weather service failed.', error: 'Weather service failed.' };
    },
  };

  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Keep checking the weather.'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [toolEntry],
    onProgress: () => {},
    promptContext: { generatedUserMemory: '', customPrompt: '', mode: 'thinking', tools: [toolEntry.definition] },
    resolveToolId: () => 'weather',
  });

  assert.equal(result.lastError, null);
  assert.equal(requestBodies[5]?.tools?.map((tool) => tool.function.name).join(','), 'get_weather');
});
