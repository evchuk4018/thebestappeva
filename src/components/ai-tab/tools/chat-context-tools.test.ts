import assert from 'node:assert/strict';
import test from 'node:test';
import { buildVisibleTools, getActiveToolEntriesForChat } from '../artifact-chat-helpers';
import type { Chat } from '../types';
import type { ToolExecutionOutcome, ToolExecutionResult } from './types';
import { createChatContextToolEntries } from './chat-context-tools';

function createChat(id: string, overrides: Partial<Chat> = {}): Chat {
  return {
    id,
    title: `Chat ${id}`,
    titleStatus: 'generated',
    messages: [],
    summary: undefined,
    summaryUpdatedAt: undefined,
    activeArtifactId: null,
    includedArtifactIds: [],
    mode: 'thinking',
    updatedAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  };
}

function getEntry(id: string, chats: Chat[], activeChatId: string | null = null) {
  let latestChats = chats;
  let latestMemory = 'Initial memory';
  const snapshots: Array<{ chats: Chat[]; generatedUserMemory: string }> = [];
  const entries = createChatContextToolEntries({
    getChats: () => latestChats,
    activeChatId,
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
  });
  const entry = entries.find((candidate) => candidate.definition.id === id);
  assert.ok(entry);
  return {
    entry,
    entries,
    getLatestChats: () => latestChats,
    getLatestMemory: () => latestMemory,
    snapshots,
  };
}

function expectToolResult(result: ToolExecutionOutcome): ToolExecutionResult {
  if ('deferred' in result) {
    assert.fail('Expected an immediate tool result.');
  }
  return result;
}

test('recent chats lists up to 10 past chats newest first and excludes the active chat', async () => {
  const chats = Array.from({ length: 12 }, (_, index) => createChat(`chat-${index + 1}`, {
    title: `Chat ${index + 1}`,
    updatedAt: `2026-06-${String(20 - index).padStart(2, '0')}T00:00:00.000Z`,
  }));
  const { entry } = getEntry('recent-chats', chats, 'chat-1');
  const result = expectToolResult(await entry.execute({
    toolId: 'recent-chats',
    functionName: 'list_recent_chats',
    args: {},
    createdAt: '2026-06-12T00:00:00.000Z',
  }, {}));

  assert.equal(result.ok, true);
  assert.deepEqual((result.data?.chats as Array<{ chatId: string }> | undefined)?.map((chat) => chat.chatId), [
    'chat-2', 'chat-3', 'chat-4', 'chat-5', 'chat-6',
    'chat-7', 'chat-8', 'chat-9', 'chat-10', 'chat-11',
  ]);
});

test('chat title search matches case-insensitively inside the recent chat pool', async () => {
  const chats = [
    createChat('chat-1', { title: 'Travel ideas', updatedAt: '2026-06-12T05:00:00.000Z' }),
    createChat('chat-2', { title: 'Boston move checklist', updatedAt: '2026-06-12T04:00:00.000Z' }),
    createChat('chat-3', { title: 'Move budget draft', updatedAt: '2026-06-12T03:00:00.000Z' }),
    createChat('chat-4', { title: 'Recipe notes', updatedAt: '2026-06-12T02:00:00.000Z' }),
  ];
  const { entry } = getEntry('chat-title-search', chats, 'chat-1');
  const result = expectToolResult(await entry.execute({
    toolId: 'chat-title-search',
    functionName: 'search_chat_titles',
    args: { query: 'MOVE', limit: 1 },
    createdAt: '2026-06-12T00:00:00.000Z',
  }, {}));

  assert.equal(result.ok, true);
  assert.equal(result.data?.resultCount, 1);
  assert.deepEqual((result.data?.chats as Array<{ chatId: string }> | undefined)?.map((chat) => chat.chatId), ['chat-2']);
});

test('chat summary returns stored summaries without refreshing', async () => {
  const { entry, snapshots } = getEntry('chat-summary', [
    createChat('chat-1', {
      title: 'Boston move checklist',
      summary: 'User is planning a move to Boston.',
      summaryUpdatedAt: '2026-06-12T01:00:00.000Z',
    }),
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('fetch should not run for stored summaries');
  };

  try {
    const result = expectToolResult(await entry.execute({
      toolId: 'chat-summary',
      functionName: 'get_chat_summary',
      args: { chatId: 'chat-1' },
      createdAt: '2026-06-12T00:00:00.000Z',
    }, {}));

    assert.equal(result.ok, true);
    assert.equal(result.data?.source, 'stored');
    assert.equal(result.data?.summary, 'User is planning a move to Boston.');
    assert.equal(snapshots.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chat summary refreshes missing summaries and syncs workspace state', async () => {
  const { entry, getLatestChats, getLatestMemory, snapshots } = getEntry('chat-summary', [
    createChat('chat-2', { title: 'Boston move checklist' }),
  ]);
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({
      chatId: 'chat-2',
      generatedUserMemory: 'Prefers concise replies.',
      summary: 'User is planning a move to Boston.',
      summaryUpdatedAt: '2026-06-12T01:00:00.000Z',
      memoryUpdated: true,
      summaryUpdated: true,
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = expectToolResult(await entry.execute({
      toolId: 'chat-summary',
      functionName: 'get_chat_summary',
      args: { chatId: 'chat-2' },
      createdAt: '2026-06-12T00:00:00.000Z',
    }, {}));

    assert.equal(result.ok, true);
    assert.equal(result.data?.source, 'generated');
    assert.equal(result.data?.summary, 'User is planning a move to Boston.');
    assert.match(requests[0] ?? '', /\/api\/ai\/chats\/chat-2\/memory-refresh$/);
    assert.equal(getLatestMemory(), 'Prefers concise replies.');
    assert.equal(getLatestChats()[0]?.summary, 'User is planning a move to Boston.');
    assert.equal(snapshots.length, 2);
    assert.equal(snapshots[1]?.generatedUserMemory, 'Prefers concise replies.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chat summary returns a clear error when no summary can be produced', async () => {
  const { entry, snapshots } = getEntry('chat-summary', [
    createChat('chat-3', { title: 'Empty chat' }),
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    chatId: 'chat-3',
    generatedUserMemory: 'Initial memory',
    summary: '',
    summaryUpdatedAt: null,
    memoryUpdated: false,
    summaryUpdated: false,
    summaryError: 'No completed exchange was available to summarize.',
  }), { headers: { 'Content-Type': 'application/json' } });

  try {
    const result = expectToolResult(await entry.execute({
      toolId: 'chat-summary',
      functionName: 'get_chat_summary',
      args: { chatId: 'chat-3' },
      createdAt: '2026-06-12T00:00:00.000Z',
    }, {}));

    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /No completed exchange was available to summarize/);
    assert.equal(snapshots.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chat context tools are assembled independently and remain separately toggleable', () => {
  const chat = createChat('chat-1');
  const { entries } = getEntry('chat-summary', [chat], 'chat-1');
  const visibleTools = buildVisibleTools(entries, { 'chat-summary': false }, chat.id, chat, 'ollama');
  const activeEntries = getActiveToolEntriesForChat(chat, entries, { 'chat-summary': false }, 'ollama');

  assert.deepEqual(
    visibleTools
      .filter((tool) => ['recent-chats', 'chat-title-search', 'chat-summary'].includes(tool.id))
      .map((tool) => ({ id: tool.id, enabled: tool.enabled })),
    [
      { id: 'recent-chats', enabled: true },
      { id: 'chat-title-search', enabled: true },
      { id: 'chat-summary', enabled: false },
    ],
  );
  assert.deepEqual(
    activeEntries
      .filter((tool) => ['recent-chats', 'chat-title-search', 'chat-summary'].includes(tool.definition.id))
      .map((tool) => tool.definition.id),
    ['recent-chats', 'chat-title-search'],
  );
});
