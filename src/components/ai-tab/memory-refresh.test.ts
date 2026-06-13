import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeMemoryRefreshIntoChats, shouldRefreshMemoryAfterTurn } from './memory-refresh';

const baseChat = {
  id: 'chat-1',
  title: 'Chat',
  titleStatus: 'pending' as const,
  messages: [],
  activeArtifactId: null,
  includedArtifactIds: [],
  mode: 'thinking' as const,
  updatedAt: '2026-06-12T00:00:00.000Z',
};

test('memory refresh runs only after completed turns with a complete assistant reply', () => {
  assert.equal(shouldRefreshMemoryAfterTurn({
    status: 'completed',
    chat: {
      ...baseChat,
      messages: [{ id: 'a', kind: 'assistant', content: 'Done', createdAt: '2026-06-12T00:00:00.000Z', status: 'complete' }],
    },
    availability: 'ready',
    lastError: null,
  }), true);

  assert.equal(shouldRefreshMemoryAfterTurn({
    status: 'completed',
    chat: {
      ...baseChat,
      messages: [{ id: 'a', kind: 'assistant', content: 'Failed', createdAt: '2026-06-12T00:00:00.000Z', status: 'error' }],
    },
    availability: 'ready',
    lastError: 'boom',
  }), false);
});

test('memory refresh merges generated summary fields into the matching chat only', () => {
  const chats = [baseChat, { ...baseChat, id: 'chat-2' }];
  const merged = mergeMemoryRefreshIntoChats(chats, {
    chatId: 'chat-1',
    generatedUserMemory: 'Prefers concise replies.',
    summary: 'The chat covered a move.',
    summaryUpdatedAt: '2026-06-12T01:00:00.000Z',
    memoryUpdated: true,
    summaryUpdated: true,
  });

  assert.equal(merged[0]?.summary, 'The chat covered a move.');
  assert.equal(merged[0]?.summaryUpdatedAt, '2026-06-12T01:00:00.000Z');
  assert.equal(merged[1]?.summary, undefined);
});
