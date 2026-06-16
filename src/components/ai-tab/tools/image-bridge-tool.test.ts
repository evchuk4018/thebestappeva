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
  objects: [{ id: 'obj_1', type: 'rectangle', bbox: [0, 0, 100, 100], dominantColors: ['#ff0000'], crops: ['full', 'left'], confidence: 0.9 }],
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
  globalThis.fetch = async () => new Response(JSON.stringify({
    attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
    sceneGraph,
    cached: true,
    model: 'qwen2.5vl:7b',
  }), { headers: { 'Content-Type': 'application/json' } });

  try {
    const tool = createImageBridgeTool([attachment]);
    const result = await tool.execute({
      toolId: 'image-bridge',
      functionName: 'extract_image_scene',
      args: { imageId: attachment.id },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});
    if ('deferred' in result) {
      assert.fail('Expected an immediate tool result.');
    }
    assert.equal(result.ok, true);
    assert.equal(result.data?.imageId, attachment.id);
    assert.equal((result.data?.sceneGraph as { objects: unknown[] }).objects.length, 1);
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
