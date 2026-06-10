import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiPreferences, parseAiWorkspaceSnapshot } from './ai-workspace-contract';

test('workspace snapshots default to ollama when selectedProvider is missing', () => {
  const snapshot = parseAiWorkspaceSnapshot({
    chats: [],
    selectedModel: 'qwen3.5:9b-q4_K_M',
    enabledTools: {},
    customSystemPrompt: '',
  });

  assert.equal(snapshot.selectedProvider, 'ollama');
  assert.equal(snapshot.selectedModel, 'qwen3.5:9b-q4_K_M');
});

test('preferences fall back to ollama for unknown providers', () => {
  const preferences = parseAiPreferences({
    selectedProvider: 'not-real',
    selectedModel: 'deepseek-v4-flash',
  });

  assert.equal(preferences.selectedProvider, 'ollama');
  assert.equal(preferences.selectedModel, 'deepseek-v4-flash');
});
