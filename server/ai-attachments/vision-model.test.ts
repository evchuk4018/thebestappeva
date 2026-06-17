import assert from 'node:assert/strict';
import test from 'node:test';
import { serverConfig } from '../config';
import { ensureVisionModelReady, getPreferredVisionModels, queryImageModel, queryVisionModelJson, resetVisionModelStateForTests } from './vision-model';

const originalVisionModels = [...serverConfig.aiVisionModels];

test('preferred vision models default to the structured-analysis order', () => {
  assert.deepEqual(getPreferredVisionModels().slice(0, 3), ['qwen3-vl:8b', 'qwen2.5vl:7b', 'qwen3-vl:4b']);
});

test('reuses an installed preferred vision model before attempting a pull', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  serverConfig.aiVisionModels = ['qwen3-vl:8b', 'qwen2.5vl:7b'];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ models: [{ name: 'qwen2.5vl:7b' }] }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    assert.equal(await ensureVisionModelReady(), 'qwen2.5vl:7b');
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiVisionModels = [...originalVisionModels];
  }
});

test('pulls the first preferred vision model when none is installed', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];
  serverConfig.aiVisionModels = ['qwen3-vl:8b', 'qwen2.5vl:7b'];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ url, body });
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3.5:9b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{"status":"success"}', { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    assert.equal(await ensureVisionModelReady(), 'qwen3-vl:8b');
    assert.match(requests[1]?.body ?? '', /qwen3-vl:8b/);
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiVisionModels = [...originalVisionModels];
  }
});

test('normalizes legacy qwen3-vl aliases in preferred vision models', () => {
  serverConfig.aiVisionModels = ['qwen3-vl:8b', 'qwen2.5vl:7b', 'qwen3-vl:4b', 'qwen3vl:4b'];

  try {
    assert.deepEqual(getPreferredVisionModels(), ['qwen3-vl:8b', 'qwen2.5vl:7b', 'qwen3-vl:4b']);
  } finally {
    serverConfig.aiVisionModels = [...originalVisionModels];
  }
});

test('reuses the exact installed qwen3-vl alias for chat requests', async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: string[] = [];
  serverConfig.aiVisionModels = ['qwen3vl:8b'];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen3-vl:8b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/chat')) {
      const body = typeof init?.body === 'string' ? init.body : '';
      chatBodies.push(body);
      return new Response(JSON.stringify({ message: { content: 'A concise answer.' } }), { headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await queryImageModel('ZmFrZQ==', 'What is in the image?');
    assert.equal(result.model, 'qwen3-vl:8b');
    assert.match(chatBodies[0] ?? '', /qwen3-vl:8b/);
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiVisionModels = [...originalVisionModels];
  }
});

test('queryVisionModelJson retries once when the first response is invalid JSON', async () => {
  const originalFetch = globalThis.fetch;
  const chatBodies: string[] = [];
  serverConfig.aiVisionModels = ['qwen2.5vl:7b'];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen2.5vl:7b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    const body = typeof init?.body === 'string' ? init.body : '';
    chatBodies.push(body);
    return new Response(JSON.stringify({ message: { content: chatBodies.length === 1 ? 'not json' : '[{\"id\":\"obj_1\",\"label\":\"left zone\",\"confidence\":0.9}]' } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await queryVisionModelJson('ZmFrZQ==', ['Label the visible objects.'], (value) => value as { id: string }[]);
    assert.equal(result.value[0]?.id, 'obj_1');
    assert.equal(chatBodies.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiVisionModels = [...originalVisionModels];
  }
});

test('retries vision chat on CPU after a CUDA kernel failure', async () => {
  resetVisionModelStateForTests();
  const originalFetch = globalThis.fetch;
  const chatBodies: string[] = [];
  serverConfig.aiVisionModels = ['qwen2.5vl:7b'];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen2.5vl:7b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/chat')) {
      const body = typeof init?.body === 'string' ? init.body : '';
      chatBodies.push(body);
      if (chatBodies.length === 1) {
        return new Response('CUDA error: device kernel image is invalid', { status: 500 });
      }
      return new Response(JSON.stringify({ message: { content: 'A concise answer.' } }), { headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  try {
    const result = await queryImageModel('ZmFrZQ==', 'What is in the image?');
    assert.equal(result.answer, 'A concise answer.');
    assert.equal(chatBodies.length, 2);
    assert.match(chatBodies[1] ?? '', /"num_gpu"\s*:\s*0/);
  } finally {
    globalThis.fetch = originalFetch;
    resetVisionModelStateForTests();
    serverConfig.aiVisionModels = [...originalVisionModels];
  }
});
