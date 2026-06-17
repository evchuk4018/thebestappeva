import assert from 'node:assert/strict';
import test from 'node:test';
import { serverConfig } from '../config';
import { createImageAnalysisVisionSession } from './vision-model-image-analysis';

const originalAnalysisModel = serverConfig.aiImageAnalysisVisionModel;
const originalAnalysisTimeoutMs = serverConfig.aiImageAnalysisVisionTimeoutMs;

function withAnalysisConfig(action: () => Promise<void>) {
  serverConfig.aiImageAnalysisVisionModel = 'qwen3-vl:8b';
  serverConfig.aiImageAnalysisVisionTimeoutMs = 30000;
  return action().finally(() => {
    serverConfig.aiImageAnalysisVisionModel = originalAnalysisModel;
    serverConfig.aiImageAnalysisVisionTimeoutMs = originalAnalysisTimeoutMs;
  });
}

test('strict image-analysis policy evicts other models and unloads on the final pass', async () => {
  const originalFetch = globalThis.fetch;
  const psPayloads = [
    { models: [{ name: 'qwen3.5:9b' }, { name: 'qwen3-vl:8b' }] },
    { models: [{ name: 'qwen3-vl:8b' }] },
  ];
  const requests: Array<{ url: string; body: string }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ url, body });
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3-vl:8b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/ps')) {
      return new Response(JSON.stringify(psPayloads.shift() ?? { models: [] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/generate')) {
      return new Response(JSON.stringify({ done: true, response: '' }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: { content: '[{"id":"obj_1","label":"zone","confidence":0.9}]' } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await withAnalysisConfig(async () => {
      const session = await createImageAnalysisVisionSession();
      try {
        const first = await session.queryJson('full', false, 'ZmFrZQ==', ['Label objects.'], (value) => value as Array<{ id: string }>);
        const second = await session.queryJson('left', true, 'ZmFrZQ==', ['Label objects.'], (value) => value as Array<{ id: string }>);
        assert.equal(first.model, 'qwen3-vl:8b');
        assert.equal(second.value[0]?.id, 'obj_1');
      } finally {
        await session.dispose();
      }
    });

    assert.match(requests[2]?.body ?? '', /"model":"qwen3\.5:9b"/);
    assert.match(requests[4]?.body ?? '', /"keep_alive":"5m"/);
    assert.doesNotMatch(requests[4]?.body ?? '', /"num_gpu"/);
    assert.match(requests[5]?.body ?? '', /"keep_alive":0/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('strict image-analysis policy does not retry on CPU or switch models after a GPU failure', async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3-vl:8b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/ps')) {
      return new Response(JSON.stringify({ models: [] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/chat')) {
      chatBodies.push(body);
      return new Response('CUDA error: device kernel image is invalid', { status: 500 });
    }
    return new Response(JSON.stringify({ done: true, response: '' }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await withAnalysisConfig(async () => {
      const session = await createImageAnalysisVisionSession();
      await assert.rejects(
        () => session.queryJson('full', true, 'ZmFrZQ==', ['Label objects.'], (value) => value as Array<{ id: string }>),
        /CUDA error: device kernel image is invalid/i,
      );
      await session.dispose();
    });

    assert.equal(chatBodies.length, 1);
    assert.match(chatBodies[0] ?? '', /"model":"qwen3-vl:8b"/);
    assert.doesNotMatch(chatBodies[0] ?? '', /"num_gpu"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('strict image-analysis policy surfaces per-pass timeout errors', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3-vl:8b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/ps')) {
      return new Response(JSON.stringify({ models: [] }), { headers: { 'Content-Type': 'application/json' } });
    }
    const error = new Error('timed out');
    error.name = 'TimeoutError';
    throw error;
  };

  try {
    await withAnalysisConfig(async () => {
      const session = await createImageAnalysisVisionSession();
      await assert.rejects(
        () => session.queryJson('right', true, 'ZmFrZQ==', ['Label objects.'], (value) => value as Array<{ id: string }>),
        /timed out after 30000ms on pass "right"/i,
      );
      await session.dispose();
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('strict image-analysis policy fails when other models stay loaded after cleanup', async () => {
  const originalFetch = globalThis.fetch;
  const psPayloads = [
    { models: [{ name: 'qwen2.5vl:7b' }] },
    { models: [{ name: 'qwen2.5vl:7b' }] },
  ];

  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3-vl:8b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/ps')) {
      return new Response(JSON.stringify(psPayloads.shift() ?? { models: [] }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ done: true, response: '' }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await withAnalysisConfig(async () => {
      await assert.rejects(
        () => createImageAnalysisVisionSession(),
        /these remain loaded: qwen2\.5vl:7b/i,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
