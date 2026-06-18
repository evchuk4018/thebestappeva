import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiImageAnalysisPayload, parseAiImageComparePayload, parseAiImageDescribePayload, parseAiImageQueryPayload } from './ai-image-bridge-contract';

const attachment = {
  id: 'image_abc123',
  kind: 'image' as const,
  createdAt: '2026-06-15T00:00:00.000Z',
  fileName: 'map.png',
  mediaType: 'image/png',
  fileSize: 256,
  width: 640,
  height: 480,
  summary: 'A labeled road map with a highlighted route.',
  summaryModel: 'qwen2.5vl:7b',
  summaryStatus: 'ready' as const,
  summaryMetadata: {
    mode: 'offline' as const,
    provider: 'local' as const,
    model: 'qwen2.5vl:7b',
    fallbackUsed: false,
    latencyMs: 10,
  },
  analysisStatus: 'ready' as const,
  analysisVersion: 'scene-graph-v1',
  analysisUpdatedAt: '2026-06-15T01:00:00.000Z',
};

const sceneGraph = {
  canvas: { width: 640, height: 480, background: '#ffffff' },
  objects: [
    {
      id: 'obj_1',
      type: 'rectangle',
      label: 'left_red_zone',
      bbox: [0, 80, 180, 500],
      dominantColors: ['#d71920'],
      fill: '#d71920',
      stroke: '#000000',
      crops: ['full', 'left'],
      confidence: 0.85,
    },
    {
      id: 'obj_2',
      type: 'line',
      label: 'divider',
      bbox: [181, 80, 183, 500],
      line: [182, 80, 182, 500],
      dominantColors: ['#000000'],
      fill: '#000000',
      stroke: '#000000',
      crops: ['full', 'center'],
      confidence: 0.92,
    },
  ],
  text: [{ value: 'R1', bbox: [45, 120, 70, 145], confidence: 0.9, objectId: 'obj_1' }],
  relationships: [{ type: 'label-for', from: 'R1', to: 'obj_1', confidence: 0.9 }],
  uncertain: [],
    diagnostics: {
    analysisVersion: 'scene-graph-v2',
    generatedAt: '2026-06-15T01:00:00.000Z',
    ocrEngine: 'rapidocr-onnxruntime',
    vlmModel: 'qwen2.5vl:7b',
    passes: ['full', 'left', 'center', 'right', 'text-ocr'],
    detail: 'layout',
    timingsMs: { total: 123 },
    objectCount: 2,
    textCount: 1,
  },
};

test('parses image-analysis payloads with scene graphs', () => {
  const payload = parseAiImageAnalysisPayload({ attachment, sceneGraph, cached: true, model: 'qwen2.5vl:7b' });
  assert.equal(payload.cached, true);
  assert.equal(payload.detail, 'layout');
  assert.equal(payload.sceneGraph.objects[0]?.label, 'left_red_zone');
  assert.equal(payload.sceneGraph.diagnostics.objectCount, 2);
  assert.deepEqual(payload.sceneGraph.objects[1]?.line, [182, 80, 182, 500]);
});

test('parses image describe and question payloads with provider metadata', () => {
  const describePayload = parseAiImageDescribePayload({
    attachment,
    summary: 'A map with a highlighted route.',
    model: 'gemini-2.5-flash-lite',
    metadata: {
      mode: 'online',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      fallbackUsed: false,
      latencyMs: 42,
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
      estimatedCostUsd: 0.0000975,
    },
  });
  const questionPayload = parseAiImageQueryPayload({
    attachment,
    answer: 'Yes, the route is highlighted in red.',
    question: 'Is the route highlighted?',
    model: 'qwen2.5vl:7b',
    metadata: {
      mode: 'online',
      provider: 'local',
      model: 'qwen2.5vl:7b',
      fallbackUsed: true,
      fallbackReason: 'Gemini timed out.',
      latencyMs: 2150,
      notice: 'Online vision was unavailable. This image was analyzed using the local vision model.',
    },
  });

  assert.equal(describePayload.metadata.provider, 'gemini');
  assert.equal(questionPayload.metadata.fallbackUsed, true);
});

test('parses image-compare payloads with patch guidance', () => {
  const payload = parseAiImageComparePayload({
    attachment,
    cached: false,
    comparison: {
      format: 'svg',
      source: sceneGraph,
      target: sceneGraph,
      pixelSimilarity: 0.92,
      issues: [{ kind: 'moved-object', sourceId: 'obj_1', targetId: 'obj_2', message: 'Object moved.', confidence: 0.4 }],
      recommendedPatches: ['Move obj_1 closer to the source layout.'],
      iterationBudget: { current: 1, max: 3, shouldContinue: true },
    },
  });
  assert.equal(payload.comparison.format, 'svg');
  assert.equal(payload.comparison.issues[0]?.kind, 'moved-object');
});

test('rejects null optional geometry fields in shared scene-graph contracts', () => {
  assert.throws(
    () => parseAiImageAnalysisPayload({
      attachment,
      cached: false,
      model: 'qwen2.5vl:7b',
      sceneGraph: {
        ...sceneGraph,
        objects: [{
          ...sceneGraph.objects[0],
          polygon: null,
          line: null,
        }],
      },
    }),
    /Expected an array/,
  );
});
