import assert from 'node:assert/strict';
import test from 'node:test';
import { aiPreferencesStorageKey } from '../../lib/ai-preferences-storage';
import { resolveRewriteModel } from './useDocsRewrite';

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

test('resolveRewriteModel uses localStorage-backed AI preferences before any server migration fetch', async () => {
  setMockWindow({
    [aiPreferencesStorageKey]: JSON.stringify({
      selectedProvider: 'deepseek',
      selectedModel: 'deepseek-v4-flash',
    }),
  });

  globalThis.fetch = async (input) => {
    throw new Error(`Unexpected fetch: ${String(input)}`);
  };

  let requestedProvider = '';
  const runtime = await resolveRewriteModel({
    listAvailableModels: async (provider) => {
      requestedProvider = provider;
      return [{
        name: 'deepseek-v4-flash',
        provider: 'deepseek',
        label: 'DeepSeek V4 Flash',
      }];
    },
  });

  assert.equal(requestedProvider, 'deepseek');
  assert.deepEqual(runtime, {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
  });
});
