import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiPreferences, parseAiWorkspaceSnapshot } from './ai-workspace-contract';

test('workspace snapshots default to ollama when selectedProvider is missing', () => {
  const snapshot = parseAiWorkspaceSnapshot({
    chats: [{
      id: 'chat-1',
      title: 'Draft',
      messages: [],
      activeArtifactId: null,
      includedArtifactIds: [],
      mode: 'thinking',
      updatedAt: '2026-06-12T00:00:00.000Z',
    }],
    selectedModel: 'qwen3.5:9b-q4_K_M',
    enabledTools: {},
    customSystemPrompt: '',
  });

  assert.equal(snapshot.selectedProvider, 'ollama');
  assert.equal(snapshot.selectedModel, 'qwen3.5:9b-q4_K_M');
  assert.equal(snapshot.chats[0]?.titleStatus, 'finalized');
});

test('preferences fall back to ollama for unknown providers', () => {
  const preferences = parseAiPreferences({
    selectedProvider: 'not-real',
    selectedModel: 'deepseek-v4-flash',
  });

  assert.equal(preferences.selectedProvider, 'ollama');
  assert.equal(preferences.selectedModel, 'deepseek-v4-flash');
});

test('workspace snapshots parse persisted chat title status', () => {
  const snapshot = parseAiWorkspaceSnapshot({
    chats: [{
      id: 'chat-1',
      title: 'Generated title',
      titleStatus: 'generated',
      messages: [],
      activeArtifactId: null,
      includedArtifactIds: [],
      mode: 'flash',
      updatedAt: '2026-06-12T00:00:00.000Z',
    }],
    selectedProvider: 'ollama',
    selectedModel: null,
    enabledTools: {},
    customSystemPrompt: '',
  });

  assert.equal(snapshot.chats[0]?.titleStatus, 'generated');
});
