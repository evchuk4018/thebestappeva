import assert from 'node:assert/strict';
import test from 'node:test';
import type { Chat } from './types';
import { syncMemoryRefreshIntoWorkspace } from './workspace-memory-sync';

function createChat(id: string, overrides: Partial<Chat> = {}): Chat {
  return {
    id,
    title: `Chat ${id}`,
    titleStatus: 'generated',
    messages: [],
    activeArtifactId: null,
    includedArtifactIds: [],
    mode: 'thinking',
    updatedAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  };
}

test('memory refresh merges into the latest chat state before flushing', async () => {
  let latestChats = [
    createChat('chat-1', { title: 'Before update' }),
  ];
  let latestMemory = 'Old memory';
  const snapshots: Array<{ chats: Chat[]; generatedUserMemory: string }> = [];

  latestChats = [
    createChat('chat-1', { title: 'Edited title', updatedAt: '2026-06-12T01:00:00.000Z' }),
    createChat('chat-2', { title: 'Newer chat' }),
  ];

  const nextChats = await syncMemoryRefreshIntoWorkspace({
    getChats: () => latestChats,
    getGeneratedUserMemory: () => latestMemory,
    getWorkspaceSnapshot: (overrides = {}) => ({
      chats: overrides.chats ?? latestChats,
      generatedUserMemory: overrides.generatedUserMemory ?? latestMemory,
      selectedProvider: 'ollama',
      selectedModel: 'qwen3.5:9b',
      enabledTools: {},
      customSystemPrompt: '',
    }),
    flushWorkspace: async ({ snapshot }) => {
      snapshots.push({ chats: snapshot.chats, generatedUserMemory: snapshot.generatedUserMemory });
    },
    setGeneratedUserMemory: (value) => {
      latestMemory = typeof value === 'function' ? value(latestMemory) : value;
    },
    setChats: (value) => {
      latestChats = typeof value === 'function' ? value(latestChats) : value;
    },
  }, {
    chatId: 'chat-1',
    generatedUserMemory: 'New memory',
    summary: 'Fresh summary',
    summaryUpdatedAt: '2026-06-12T02:00:00.000Z',
    memoryUpdated: true,
    summaryUpdated: true,
  });

  assert.equal(nextChats[0]?.title, 'Edited title');
  assert.equal(nextChats[0]?.summary, 'Fresh summary');
  assert.equal(nextChats[1]?.id, 'chat-2');
  assert.equal(latestMemory, 'New memory');
  assert.equal(snapshots[0]?.chats[0]?.title, 'Edited title');
  assert.equal(snapshots[0]?.generatedUserMemory, 'New memory');
});
