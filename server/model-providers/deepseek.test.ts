import assert from 'node:assert/strict';
import test from 'node:test';

test('DeepSeek status never includes the API key value', async () => {
  process.env.DEEPSEEK_API_KEY = 'super-secret-key';
  process.env.DEEPSEEK_MODEL = 'deepseek-v4-flash';
  process.env.DEEPSEEK_MODEL_LABEL = 'DeepSeek V4 Flash';

  const { createDeepSeekProvider } = await import('./deepseek');
  const provider = createDeepSeekProvider();
  const status = await provider.getStatus();

  assert.equal(status.option.configured, true);
  assert.match(status.option.detail, /api key loaded from \.env/i);
  assert.doesNotMatch(JSON.stringify(status), /super-secret-key/);
});
