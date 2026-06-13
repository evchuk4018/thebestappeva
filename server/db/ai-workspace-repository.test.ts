import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { createAiWorkspaceRepository } from './ai-workspace-repository';
import { ensureDatabaseSchema } from './schema';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  ensureDatabaseSchema(database);
  return { database, repository: createAiWorkspaceRepository(database) };
}

test('workspace repository stores generated user memory', () => {
  const { repository } = createTestRepository();

  repository.saveGeneratedUserMemory('Prefers concise replies.');

  assert.equal(repository.loadGeneratedUserMemory(), 'Prefers concise replies.');
});

test('workspace repository updates one chat summary without changing chat ordering fields', () => {
  const { repository } = createTestRepository();
  repository.saveAiWorkspace({
    chats: [{
      id: 'chat-1',
      title: 'Chat',
      titleStatus: 'pending',
      messages: [],
      activeArtifactId: null,
      includedArtifactIds: [],
      mode: 'thinking',
      updatedAt: '2026-06-12T00:00:00.000Z',
    }],
    generatedUserMemory: '',
    selectedProvider: 'ollama',
    selectedModel: null,
    enabledTools: {},
    customSystemPrompt: '',
  });

  const updated = repository.updateChatSummary('chat-1', 'The user is planning a move.', '2026-06-12T01:00:00.000Z');

  assert.equal(updated?.summary, 'The user is planning a move.');
  assert.equal(updated?.summaryUpdatedAt, '2026-06-12T01:00:00.000Z');
  assert.equal(updated?.updatedAt, '2026-06-12T00:00:00.000Z');
  assert.equal(repository.findChatById('chat-1')?.summary, 'The user is planning a move.');
});
