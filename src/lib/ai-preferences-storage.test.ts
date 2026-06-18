import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aiPreferencesStorageKey,
  loadAiPreferencesWithStorage,
  readAiPreferencesFromLocalStorage,
  saveAiPreferencesToLocalStorage,
} from './ai-preferences-storage';

const originalWindow = globalThis.window;

function setMockWindow(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const localStorage = {
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key) ?? null : null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  globalThis.window = { localStorage } as Window & typeof globalThis;
  return { localStorage, store };
}

test.afterEach(() => {
  globalThis.window = originalWindow;
});

test('reads valid AI preferences from localStorage', () => {
  setMockWindow({
    [aiPreferencesStorageKey]: JSON.stringify({
      selectedProvider: 'deepseek',
      selectedModel: 'deepseek-v4-flash',
    }),
  });

  assert.deepEqual(readAiPreferencesFromLocalStorage(), {
    selectedProvider: 'deepseek',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'offline',
  });
});

test('normalizes stale providers and preserves the stored model', () => {
  setMockWindow({
    [aiPreferencesStorageKey]: JSON.stringify({
      selectedProvider: 'not-real',
      selectedModel: 'deepseek-v4-flash',
    }),
  });

  assert.deepEqual(readAiPreferencesFromLocalStorage(), {
    selectedProvider: 'ollama',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'offline',
  });
});

test('migrates server AI preferences into localStorage when the stored payload is invalid', async () => {
  const { store } = setMockWindow({
    [aiPreferencesStorageKey]: '{bad json',
  });

  const preferences = await loadAiPreferencesWithStorage(async () => ({
    selectedProvider: 'deepseek',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'offline',
  }));

  assert.deepEqual(preferences, {
    selectedProvider: 'deepseek',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'offline',
  });
  assert.equal(
    store.get(aiPreferencesStorageKey),
    JSON.stringify({
      selectedProvider: 'deepseek',
      selectedModel: 'deepseek-v4-flash',
      visionMode: 'offline',
    }),
  );
});

test('migrates server AI preferences once when localStorage is empty', async () => {
  setMockWindow();

  let fetchCount = 0;
  const first = await loadAiPreferencesWithStorage(async () => {
    fetchCount += 1;
    return {
      selectedProvider: 'deepseek',
      selectedModel: 'deepseek-v4-flash',
      visionMode: 'offline',
    };
  });
  const second = await loadAiPreferencesWithStorage(async () => {
    fetchCount += 1;
    return {
      selectedProvider: 'ollama',
      selectedModel: 'qwen3.5:9b-q4_K_M',
      visionMode: 'offline',
    };
  });

  assert.deepEqual(first, {
    selectedProvider: 'deepseek',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'offline',
  });
  assert.deepEqual(second, first);
  assert.equal(fetchCount, 1);
});

test('prefers localStorage and skips migration once preferences are stored', async () => {
  setMockWindow();
  saveAiPreferencesToLocalStorage({
    selectedProvider: 'deepseek',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'online',
  });

  let fetchCount = 0;
  const preferences = await loadAiPreferencesWithStorage(async () => {
    fetchCount += 1;
    return {
      selectedProvider: 'ollama',
      selectedModel: 'qwen3.5:9b-q4_K_M',
      visionMode: 'offline',
    };
  });

  assert.deepEqual(preferences, {
    selectedProvider: 'deepseek',
    selectedModel: 'deepseek-v4-flash',
    visionMode: 'online',
  });
  assert.equal(fetchCount, 0);
});
