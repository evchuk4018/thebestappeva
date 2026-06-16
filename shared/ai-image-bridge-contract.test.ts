import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiImageAnalysisPayload, parseAiImageComparePayload } from './ai-image-bridge-contract';

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
  analysisStatus: 'ready' as const,
  analysisVersion: 'scene-graph-v1',
  analysisUpdatedAt: '2026-06-15T01:00:00.000Z',
};

const sceneGraph = {
  canvas: { width: 640, height: 480, background: '#ffffff' },
  objects: [{
    id: 'obj_1',
    type: 'rectangle',
    label: 'left_red_zone',
    bbox: [0, 80, 180, 500],
    dominantColors: ['#d71920'],
    fill: '#d71920',
    stroke: '#000000',
    crops: ['full', 'left'],
    confidence: 0.85,
  }],
  text: [{ value: 'R1', bbox: [45, 120, 70, 145], confidence: 0.9, objectId: 'obj_1' }],
  relationships: [{ type: 'label-for', from: 'R1', to: 'obj_1', confidence: 0.9 }],
  uncertain: [],
  diagnostics: {
    analysisVersion: 'scene-graph-v1',
    generatedAt: '2026-06-15T01:00:00.000Z',
    ocrEngine: 'rapidocr-onnxruntime',
    vlmModel: 'qwen2.5vl:7b',
    passes: ['full', 'left', 'center', 'right', 'text-ocr'],
  },
};

test('parses image-analysis payloads with scene graphs', () => {
  const payload = parseAiImageAnalysisPayload({ attachment, sceneGraph, cached: true, model: 'qwen2.5vl:7b' });
  assert.equal(payload.cached, true);
  assert.equal(payload.sceneGraph.objects[0]?.label, 'left_red_zone');
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
