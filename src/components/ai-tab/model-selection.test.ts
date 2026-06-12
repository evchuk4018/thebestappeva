import assert from 'node:assert/strict';
import test from 'node:test';
import { groupModelsByProvider, resolveModelSelection, resolveProviderForModel, sortModelsForDisplay } from './model-selection';

const models = sortModelsForDisplay([
  { name: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', provider: 'deepseek' },
  { name: 'qwen3.5:9b-q4_K_M', label: 'Qwen 3.5 9B', provider: 'ollama' },
  { name: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', provider: 'deepseek' },
]);

test('groups combined models by provider for the unified selector', () => {
  const grouped = groupModelsByProvider(models);

  assert.deepEqual(grouped.ollama.map((model) => model.name), ['qwen3.5:9b-q4_K_M']);
  assert.deepEqual(grouped.deepseek.map((model) => model.name), ['deepseek-v4-flash', 'deepseek-v4-pro']);
});

test('resolves the provider from the selected model regardless of the preferred provider', () => {
  assert.equal(resolveProviderForModel(models, 'deepseek-v4-flash'), 'deepseek');

  const selection = resolveModelSelection(models, 'ollama', 'deepseek-v4-flash');
  assert.deepEqual(selection, {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
  });
});

test('falls back to the preferred provider or the first available model when reconciling selection', () => {
  assert.deepEqual(resolveModelSelection(models, 'ollama', null), {
    provider: 'ollama',
    model: 'qwen3.5:9b-q4_K_M',
  });

  assert.deepEqual(resolveModelSelection(models, 'deepseek', 'missing-model'), {
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
  });

  assert.deepEqual(resolveModelSelection([], 'deepseek', null), {
    provider: 'deepseek',
    model: null,
  });
});
