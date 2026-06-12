import assert from 'node:assert/strict';
import test from 'node:test';
import { aiPreferencesStorageKey } from './ai-preferences-storage';
import { loadAiWorkspace } from './ai-workspace-storage';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

function setMockWindow(seed: Record<string, string>) {
  const store = new Map(Object.entries(seed));
  globalThis.window = {
    localStorage: {
      getItem(key: string) {
        return store.has(key) ? store.get(key) ?? null : null;
      },
      setItem(key: string, value: string) {
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  } as Window & typeof globalThis;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

test('loads chats from the workspace API while hydrating provider preferences from localStorage', async () => {
  setMockWindow({
    [aiPreferencesStorageKey]: JSON.stringify({
      selectedProvider: 'deepseek',
      selectedModel: 'deepseek-v4-flash',
    }),
  });

  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    if (url !== '/api/ai/workspace') {
      throw new Error(`Unexpected request: ${url}`);
    }

    return new Response(JSON.stringify({
      chats: [{
        id: 'chat-1',
        title: 'Migrated',
        messages: [],
        activeArtifactId: null,
        includedArtifactIds: [],
        mode: 'thinking',
        updatedAt: '2026-06-12T00:00:00.000Z',
      }],
      selectedProvider: 'ollama',
      selectedModel: 'qwen3.5:9b-q4_K_M',
      enabledTools: { web_search: true },
      customSystemPrompt: 'Keep it tight.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const workspace = await loadAiWorkspace();

  assert.equal(workspace.chats.length, 1);
  assert.equal(workspace.chats[0]?.id, 'chat-1');
  assert.deepEqual(workspace.enabledTools, { web_search: true });
  assert.equal(workspace.customSystemPrompt, 'Keep it tight.');
  assert.equal(workspace.selectedProvider, 'deepseek');
  assert.equal(workspace.selectedModel, 'deepseek-v4-flash');
  assert.deepEqual(requests, ['/api/ai/workspace']);
});
