import assert from 'node:assert/strict';
import test from 'node:test';
import { serverConfig } from '../config';

const originalFetch = globalThis.fetch;
const originalDeepSeekApiKey = serverConfig.deepseekApiKey;
const originalDeepSeekBaseUrl = serverConfig.deepseekBaseUrl;

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  serverConfig.deepseekApiKey = originalDeepSeekApiKey;
  serverConfig.deepseekBaseUrl = originalDeepSeekBaseUrl;
});

test('DeepSeek status loads supported V4 models from /models without leaking the API key', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';

  globalThis.fetch = async () => jsonResponse({
    object: 'list',
    data: [
      { id: 'deepseek-v4-flash' },
      { id: 'deepseek-v4-pro' },
      { id: 'ignored-model' },
    ],
  });

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const status = await provider.getStatus();

  assert.equal(status.option.configured, true);
  assert.equal(status.option.status, 'ready');
  assert.equal(status.option.defaultModel, 'deepseek-v4-flash');
  assert.equal(status.option.defaultModelLabel, 'DeepSeek V4 Flash');
  assert.deepEqual(status.models.map((model) => model.name), ['deepseek-v4-flash', 'deepseek-v4-pro']);
  assert.doesNotMatch(JSON.stringify(status), /super-secret-key/);
});

test('DeepSeek status reports the endpoint as unavailable when model discovery fails', async () => {
  serverConfig.deepseekApiKey = 'super-secret-key';

  globalThis.fetch = async () => jsonResponse({ error: 'Service unavailable' }, { status: 503 });

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const status = await provider.getStatus();

  assert.equal(status.option.status, 'unavailable');
  assert.match(status.option.detail, /service unavailable/i);
  assert.equal(status.models.length, 0);
});
