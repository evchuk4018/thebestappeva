import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiMemoryService, extractLatestCompletedExchange } from './ai-memory-service';

function createChat() {
  return {
    id: 'chat-1',
    title: 'Chat',
    titleStatus: 'pending' as const,
    messages: [
      { id: 'u1', kind: 'user' as const, content: 'I am moving to Boston.', createdAt: '2026-06-12T00:00:00.000Z' },
      { id: 'a1', kind: 'assistant' as const, content: 'Boston has strong transit.', createdAt: '2026-06-12T00:01:00.000Z', status: 'complete' as const },
      { id: 'u2', kind: 'user' as const, content: 'Keep replies short.', createdAt: '2026-06-12T00:02:00.000Z' },
      { id: 'a2', kind: 'assistant' as const, content: 'Will do.', createdAt: '2026-06-12T00:03:00.000Z', status: 'complete' as const },
    ],
    activeArtifactId: null,
    includedArtifactIds: [],
    mode: 'thinking' as const,
    updatedAt: '2026-06-12T00:03:00.000Z',
    summary: 'The chat is about a move.',
    summaryUpdatedAt: '2026-06-12T00:03:00.000Z',
  };
}

function createRepository(chat = createChat()) {
  const state = { chat, memory: 'Likes concise replies.' };
  return {
    state,
    repository: {
      findChatById: (chatId: string) => chatId === state.chat.id ? state.chat : null,
      loadGeneratedUserMemory: () => state.memory,
      saveGeneratedUserMemory: (value: string) => {
        state.memory = value;
      },
      updateChatSummary: (chatId: string, summary: string, summaryUpdatedAt: string | null) => {
        if (chatId !== state.chat.id) {
          return null;
        }
        state.chat = { ...state.chat, summary, summaryUpdatedAt: summaryUpdatedAt ?? undefined };
        return state.chat;
      },
    },
  };
}

test('extractLatestCompletedExchange returns the latest complete user-assistant pair', () => {
  const exchange = extractLatestCompletedExchange(createChat());

  assert.equal(exchange?.userMessage.id, 'u2');
  assert.equal(exchange?.assistantMessage.id, 'a2');
});

test('memory service preserves prior values when the background calls fail or return empty text', async () => {
  const { state, repository } = createRepository();
  let calls = 0;
  const seenOptions: Array<{ model: string; think: boolean | undefined }> = [];
  const provider = {
    callChatStream: async ({ model, think }: { model: string; think?: boolean }) => {
      calls += 1;
      seenOptions.push({ model, think });
      if (calls === 1) {
        throw new Error('boom');
      }
      return { model: 'deepseek-v4-flash', content: 'The selected model returned an empty response.' };
    },
  };

  const payload = await createAiMemoryService(repository, provider).refreshChatMemory('chat-1');

  assert.equal(payload.generatedUserMemory, 'Likes concise replies.');
  assert.equal(payload.summary, 'The chat is about a move.');
  assert.equal(payload.memoryUpdated, false);
  assert.equal(payload.summaryUpdated, false);
  assert.equal(state.memory, 'Likes concise replies.');
  assert.deepEqual(seenOptions, [
    { model: 'deepseek-v4-flash', think: false },
    { model: 'deepseek-v4-flash', think: false },
  ]);
});

test('memory service saves successful memory and summary rewrites', async () => {
  const { state, repository } = createRepository();
  let calls = 0;
  const seenOptions: Array<{ model: string; think: boolean | undefined }> = [];
  const provider = {
    callChatStream: async ({ model, think }: { model: string; think?: boolean }) => {
      calls += 1;
      seenOptions.push({ model, think });
      return calls === 1
        ? { model: 'deepseek-v4-flash', content: 'Prefers concise replies.\n\nPlanning a move to Boston.' }
        : { model: 'deepseek-v4-flash', content: 'The chat covers a Boston move.\n\nThe user asked for shorter replies.' };
    },
  };

  const payload = await createAiMemoryService(repository, provider, () => '2026-06-12T01:00:00.000Z').refreshChatMemory('chat-1');

  assert.equal(payload.generatedUserMemory, 'Prefers concise replies.\n\nPlanning a move to Boston.');
  assert.equal(payload.summary, 'The chat covers a Boston move.\n\nThe user asked for shorter replies.');
  assert.equal(payload.summaryUpdatedAt, '2026-06-12T01:00:00.000Z');
  assert.equal(state.memory, 'Prefers concise replies.\n\nPlanning a move to Boston.');
  assert.equal(state.chat.summary, 'The chat covers a Boston move.\n\nThe user asked for shorter replies.');
  assert.deepEqual(seenOptions, [
    { model: 'deepseek-v4-flash', think: false },
    { model: 'deepseek-v4-flash', think: false },
  ]);
});

test('memory service propagates aborts without persisting partial refreshes', async () => {
  const { state, repository } = createRepository();
  const controller = new AbortController();
  let sawSignal = false;
  let resolveStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve;
  });
  const provider = {
    callChatStream: async ({ signal, model, think }: { signal?: AbortSignal; model: string; think?: boolean }) => {
      sawSignal = signal === controller.signal;
      assert.equal(model, 'deepseek-v4-flash');
      assert.equal(think, false);
      resolveStarted();
      return await new Promise<never>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  };

  const refreshPromise = createAiMemoryService(repository, provider).refreshChatMemory('chat-1', { signal: controller.signal });
  await started;
  controller.abort(new DOMException('Stopped background refresh.', 'AbortError'));

  await assert.rejects(refreshPromise, (error: unknown) => error instanceof Error && error.name === 'AbortError');
  assert.equal(sawSignal, true);
  assert.equal(state.memory, 'Likes concise replies.');
  assert.equal(state.chat.summary, 'The chat is about a move.');
});
