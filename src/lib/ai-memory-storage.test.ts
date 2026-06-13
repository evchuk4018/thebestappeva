import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshAiChatMemory } from './ai-memory-storage';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('refreshAiChatMemory posts to the memory-refresh endpoint and parses the response', async () => {
  const requests: Array<{ url: string; method: string }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: String(init?.method ?? 'GET') });
    return new Response(JSON.stringify({
      chatId: 'chat-1',
      generatedUserMemory: 'Prefers concise replies.',
      summary: 'The chat covered a move.',
      summaryUpdatedAt: '2026-06-12T01:00:00.000Z',
      memoryUpdated: true,
      summaryUpdated: true,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const payload = await refreshAiChatMemory('chat-1');

  assert.equal(payload.chatId, 'chat-1');
  assert.equal(payload.generatedUserMemory, 'Prefers concise replies.');
  assert.deepEqual(requests, [{ url: '/api/ai/chats/chat-1/memory-refresh', method: 'POST' }]);
});
