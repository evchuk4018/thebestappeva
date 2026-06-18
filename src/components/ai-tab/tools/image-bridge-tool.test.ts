import assert from 'node:assert/strict';
import test from 'node:test';
import { createImageBridgeTool } from './image-bridge-tool';

const attachment = {
  id: 'image_map123',
  kind: 'image' as const,
  fileName: 'map.png',
  mediaType: 'image/png',
  fileSize: 200,
  summary: 'A road map with labels.',
  summaryModel: 'qwen2.5vl:7b',
  summaryStatus: 'ready' as const,
};

const sceneGraph = {
  canvas: { width: 640, height: 480, background: '#ffffff' },
  objects: [
    {
      id: 'obj_1',
      type: 'rectangle',
      bbox: [0, 0, 100, 100],
      polygon: [[0, 0], [100, 0], [100, 100], [0, 100]],
      dominantColors: ['#ff0000'],
      crops: ['full', 'left'],
      confidence: 0.9,
    },
    {
      id: 'obj_2',
      type: 'line',
      bbox: [110, 0, 112, 100],
      line: [111, 0, 111, 100],
      dominantColors: ['#000000'],
      crops: ['full', 'center'],
      confidence: 0.88,
    },
  ],
  text: [],
  relationships: [],
  uncertain: [],
  diagnostics: {
    analysisVersion: 'scene-graph-v1',
    generatedAt: '2026-06-15T00:00:00.000Z',
    ocrEngine: 'rapidocr-onnxruntime',
    vlmModel: 'qwen2.5vl:7b',
    passes: ['full'],
  },
};

test('extract_image_scene proxies the structured analysis route', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = '';
  globalThis.fetch = async (_input, init) => {
    requestBody = typeof init?.body === 'string' ? init.body : '';
    return new Response(JSON.stringify({
    attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
    sceneGraph,
    cached: true,
    model: 'qwen2.5vl:7b',
    detail: 'semantic',
  }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const tool = createImageBridgeTool([attachment]);
    const result = await tool.execute({
      toolId: 'image-bridge',
      functionName: 'extract_image_scene',
      args: { imageId: attachment.id, detail: 'semantic' },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});
    if ('deferred' in result) {
      assert.fail('Expected an immediate tool result.');
    }
    assert.equal(result.ok, true);
    assert.equal(result.data?.imageId, attachment.id);
    assert.equal(result.data?.detail, 'semantic');
    assert.match(requestBody, /"detail":"semantic"/);
    assert.deepEqual((result.data?.sceneGraph as { objects: Array<{ line?: number[] }> }).objects[1]?.line, [111, 0, 111, 100]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('describe_image and ask_image_model proxy the provider-independent image routes', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    if (url.endsWith('/image-describe')) {
      return new Response(JSON.stringify({
        attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
        summary: 'A map with a highlighted route.',
        model: 'gemini-2.5-flash-lite',
        metadata: {
          mode: 'online',
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          fallbackUsed: false,
          latencyMs: 42,
        },
      }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({
      attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
      answer: 'Yes, the route is highlighted.',
      question: 'Is the route highlighted?',
      model: 'qwen2.5vl:7b',
      metadata: {
        mode: 'online',
        provider: 'local',
        model: 'qwen2.5vl:7b',
        fallbackUsed: true,
        fallbackReason: 'Gemini timed out.',
        latencyMs: 2050,
        notice: 'Online vision was unavailable. This image was analyzed using the local vision model.',
      },
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const tool = createImageBridgeTool([attachment]);
    const describe = await tool.execute({
      toolId: 'image-bridge',
      functionName: 'describe_image',
      args: { imageId: attachment.id },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});
    const answer = await tool.execute({
      toolId: 'image-bridge',
      functionName: 'ask_image_model',
      args: { imageId: attachment.id, question: 'Is the route highlighted?' },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});
    if ('deferred' in describe || 'deferred' in answer) {
      assert.fail('Expected immediate tool results.');
    }
    assert.equal((describe.data?.metadata as { provider: string } | undefined)?.provider, 'gemini');
    assert.equal((answer.data?.metadata as { fallbackUsed: boolean } | undefined)?.fallbackUsed, true);
    assert.match(requests[1]?.body ?? '', /Is the route highlighted\?/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('describe_image enforces the per-message vision call cap', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
    summary: 'A map with a highlighted route.',
    model: 'qwen2.5vl:7b',
    metadata: {
      mode: 'offline',
      provider: 'local',
      model: 'qwen2.5vl:7b',
      fallbackUsed: false,
      latencyMs: 20,
    },
  }), { headers: { 'Content-Type': 'application/json' } });

  try {
    const tool = createImageBridgeTool([attachment], 1);
    await tool.execute({
      toolId: 'image-bridge',
      functionName: 'describe_image',
      args: { imageId: attachment.id },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});
    await assert.rejects(
      () => tool.execute({
        toolId: 'image-bridge',
        functionName: 'describe_image',
        args: { imageId: attachment.id },
        createdAt: '2026-06-15T00:00:00.000Z',
      }, {}),
      /per-message vision call limit/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('compare_generated_image proxies structured SVG comparison', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
    cached: false,
    comparison: {
      format: 'svg',
      source: sceneGraph,
      target: sceneGraph,
      pixelSimilarity: 0.91,
      issues: [],
      recommendedPatches: [],
      iterationBudget: { current: 1, max: 3, shouldContinue: false },
    },
  }), { headers: { 'Content-Type': 'application/json' } });

  try {
    const tool = createImageBridgeTool([attachment]);
    const result = await tool.execute({
      toolId: 'image-bridge',
      functionName: 'compare_generated_image',
      args: { imageId: attachment.id, content: '<svg />' },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});
    if ('deferred' in result) {
      assert.fail('Expected an immediate tool result.');
    }
    assert.equal(result.ok, true);
    assert.equal((result.data?.comparison as { format: string }).format, 'svg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
