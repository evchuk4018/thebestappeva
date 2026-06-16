import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureVisionModelReady } from './vision-model';

test('reuses an installed preferred vision model before attempting a pull', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ models: [{ name: 'qwen2.5vl:7b' }] }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    assert.equal(await ensureVisionModelReady(), 'qwen2.5vl:7b');
    assert.equal(requests.length, 1);
    assert.match(requests[0] ?? '', /\/api\/tags$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('pulls the top preferred vision model when none is installed', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ url, body });

    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3.5:9b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('{"status":"success"}\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
  };

  try {
    assert.equal(await ensureVisionModelReady(), 'openbmb/minicpm-v4.5:8b');
    assert.match(requests[1]?.url ?? '', /\/api\/pull$/);
    assert.match(requests[1]?.body ?? '', /openbmb\/minicpm-v4\.5:8b/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
