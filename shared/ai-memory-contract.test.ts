import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiMemoryRefreshResponse } from './ai-memory-contract';

test('memory refresh responses parse optional soft-failure fields', () => {
  const payload = parseAiMemoryRefreshResponse({
    chatId: 'chat-1',
    generatedUserMemory: 'Prefers concise replies.',
    summary: 'The chat covered a move plan.',
    summaryUpdatedAt: '2026-06-12T00:00:00.000Z',
    memoryUpdated: true,
    summaryUpdated: false,
    summaryError: 'Background model unavailable.',
  });

  assert.equal(payload.chatId, 'chat-1');
  assert.equal(payload.generatedUserMemory, 'Prefers concise replies.');
  assert.equal(payload.summaryUpdatedAt, '2026-06-12T00:00:00.000Z');
  assert.equal(payload.memoryUpdated, true);
  assert.equal(payload.summaryUpdated, false);
  assert.equal(payload.summaryError, 'Background model unavailable.');
});
