import assert from 'node:assert/strict';
import test from 'node:test';
import { createNewChat, createUserMessage } from './helpers';
import { isPendingToolCallStep, setImageToolRetryIndicatorDelayForTests } from './tool-call-progress';
import { resolveThinkingTurn } from './thinking-turn';
import { ToolRegistryEntry } from './tools/types';

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
  setImageToolRetryIndicatorDelayForTests(null);
});

test('marks long-running image tools as retrying and clears the pending state after settlement', async () => {
  setImageToolRetryIndicatorDelayForTests(0);
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return createStreamResponse([
        createToolCallsEvent([{ id: 'tool-1', function: { name: 'extract_image_scene', arguments: { imageId: 'image_1' } } }]),
        createDoneEvent(),
      ]);
    }
    return createStreamResponse([createContentEvent('Finished.', 'Finished.'), createDoneEvent()]);
  };

  const seenStatuses: string[] = [];
  const toolEntry: ToolRegistryEntry = {
    definition: {
      id: 'image-bridge',
      label: 'Image Bridge',
      alias: '/image-bridge',
      description: 'Image tooling',
      enabledByDefault: true,
      functions: [{ name: 'extract_image_scene', description: 'Extract scene graph', parameters: [] }],
    },
    execute: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { toolId: 'image-bridge', functionName: 'extract_image_scene', ok: true, summary: 'Scene extracted.' };
    },
  };

  const result = await resolveThinkingTurn({
    chat: createNewChat(createUserMessage('Inspect this image.'), 'thinking'),
    model: 'qwen',
    provider: 'ollama',
    activeToolEntries: [toolEntry],
    onProgress: (chat) => {
      const assistant = [...chat.messages].reverse().find((message) => message.kind === 'assistant');
      const toolCall = assistant?.kind === 'assistant' ? assistant.trace?.find((step) => step.kind === 'tool-call') : null;
      if (toolCall?.kind === 'tool-call' && toolCall.toolState?.status) {
        seenStatuses.push(toolCall.toolState.status);
      }
    },
    promptContext: { generatedUserMemory: '', customPrompt: '', mode: 'thinking', tools: [toolEntry.definition] },
    resolveToolId: () => 'image-bridge',
  });

  const assistant = result.chat.messages.at(-1);
  assert(assistant && assistant.kind === 'assistant');
  const toolCallIndex = assistant.trace?.findIndex((step) => step.kind === 'tool-call') ?? -1;
  assert(toolCallIndex >= 0);
  const toolCall = assistant.trace?.[toolCallIndex];
  assert(toolCall && toolCall.kind === 'tool-call');
  assert.equal(isPendingToolCallStep(toolCall, assistant.trace ?? [], toolCallIndex), false);
  assert(seenStatuses.includes('retrying'));
});
