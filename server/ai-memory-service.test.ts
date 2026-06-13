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
  const provider = {
    getStatus: async () => ({
      option: { value: 'ollama' as const, label: 'Ollama', configured: true, status: 'ready' as const, detail: 'ok', defaultModel: null, defaultModelLabel: null },
      models: [{ name: 'qwen3.5:9b', provider: 'ollama' as const }],
    }),
    callChatStream: async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error('boom');
      }
      return { model: 'qwen3.5:9b', content: 'The selected model returned an empty response.' };
    },
  };

  const payload = await createAiMemoryService(repository, provider).refreshChatMemory('chat-1');

  assert.equal(payload.generatedUserMemory, 'Likes concise replies.');
  assert.equal(payload.summary, 'The chat is about a move.');
  assert.equal(payload.memoryUpdated, false);
  assert.equal(payload.summaryUpdated, false);
  assert.equal(state.memory, 'Likes concise replies.');
});

test('memory service saves successful memory and summary rewrites', async () => {
  const { state, repository } = createRepository();
  let calls = 0;
  const provider = {
    getStatus: async () => ({
      option: { value: 'ollama' as const, label: 'Ollama', configured: true, status: 'ready' as const, detail: 'ok', defaultModel: null, defaultModelLabel: null },
      models: [{ name: 'qwen3.5:9b', provider: 'ollama' as const }],
    }),
    callChatStream: async () => {
      calls += 1;
      return calls === 1
        ? { model: 'qwen3.5:9b', content: 'Prefers concise replies.\n\nPlanning a move to Boston.' }
        : { model: 'qwen3.5:9b', content: 'The chat covers a Boston move.\n\nThe user asked for shorter replies.' };
    },
  };

  const payload = await createAiMemoryService(repository, provider, () => '2026-06-12T01:00:00.000Z').refreshChatMemory('chat-1');

  assert.equal(payload.generatedUserMemory, 'Prefers concise replies.\n\nPlanning a move to Boston.');
  assert.equal(payload.summary, 'The chat covers a Boston move.\n\nThe user asked for shorter replies.');
  assert.equal(payload.summaryUpdatedAt, '2026-06-12T01:00:00.000Z');
  assert.equal(state.memory, 'Prefers concise replies.\n\nPlanning a move to Boston.');
  assert.equal(state.chat.summary, 'The chat covers a Boston move.\n\nThe user asked for shorter replies.');
});
