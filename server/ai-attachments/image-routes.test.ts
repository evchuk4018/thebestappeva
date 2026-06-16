import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { AiImageSceneGraph } from '../../shared/ai-image-bridge-contract';
import { serverConfig } from '../config';
import { handlePostAiImageAnalysis, handlePostAiImageCompare, handlePostAiImageQuestion } from './image-routes';
import { saveAttachmentRecord, saveAttachmentSource } from './storage';
import { setImageAnalysisTestHooksForTests } from './image-analysis-service';
import { setRenderSvgHookForTests } from './image-compare-service';

function createResponseCapture() {
  return {
    body: undefined as unknown,
    statusCode: 200,
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
}

const imageAttachment = {
  id: 'image_map123',
  kind: 'image' as const,
  createdAt: '2026-06-15T00:00:00.000Z',
  fileName: 'map.png',
  mediaType: 'image/png',
  fileSize: 12,
  width: 640,
  height: 480,
  summary: 'A street map.',
  summaryModel: 'qwen2.5vl:7b',
  summaryStatus: 'ready' as const,
  analysisStatus: 'idle' as const,
};

const sceneGraph: AiImageSceneGraph = {
  canvas: { width: 640, height: 480, background: '#ffffff' },
  objects: [{ id: 'obj_1', type: 'rectangle', label: 'left_zone', bbox: [0, 0, 120, 120], dominantColors: ['#ff0000'], fill: '#ff0000', stroke: '#000000', crops: ['full', 'left'], confidence: 0.9 }],
  text: [{ value: 'R1', bbox: [5, 5, 20, 20], confidence: 0.9, objectId: 'obj_1' }],
  relationships: [],
  uncertain: [],
  diagnostics: {
    analysisVersion: 'scene-graph-v1',
    generatedAt: '2026-06-15T00:00:00.000Z',
    ocrEngine: 'rapidocr-onnxruntime',
    vlmModel: 'qwen2.5vl:7b',
    passes: ['full', 'left', 'center', 'right', 'text-ocr'],
  },
};

test('image query route sends stored image bytes plus the question to Ollama', async () => {
  const originalFetch = globalThis.fetch;
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-query-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  const fetchBodies: string[] = [];

  globalThis.fetch = async (input, init) => {
    fetchBodies.push(typeof init?.body === 'string' ? init.body : '');
    if (String(input).endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [{ name: 'qwen2.5vl:7b' }] }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: { content: 'Yes, it is a map.' } }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageQuestion({ params: { attachmentId: imageAttachment.id }, body: { question: 'Is this image a map?' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { answer?: string }).answer, 'Yes, it is a map.');
    assert.match(fetchBodies[1] ?? '', /Is this image a map\?/);
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image-analysis route returns cached or freshly analyzed scene graphs', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-analysis-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  setImageAnalysisTestHooksForTests({
    analyzeFile: async () => ({ sceneGraph, debugImages: {} }),
    queryJson: async () => ({ model: 'qwen2.5vl:7b', value: [{ id: 'obj_1', label: 'left_zone', type: 'rectangle', confidence: 0.95 }] }),
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const first = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true } } as never, first as never);
    assert.equal(first.statusCode, 200);
    assert.equal((first.body as { cached: boolean }).cached, false);

    const second = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: {} } as never, second as never);
    assert.equal((second.body as { cached: boolean }).cached, true);
  } finally {
    setImageAnalysisTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image-compare route returns structured SVG comparison guidance', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-compare-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  setImageAnalysisTestHooksForTests({
    analyzeFile: async (filePath: string) => {
      if (filePath.endsWith('.png') && filePath.includes('ai-image-analysis-')) {
        return { sceneGraph, debugImages: {} };
      }
      return {
        sceneGraph: {
          ...sceneGraph,
          objects: [],
          text: [],
          diagnostics: { ...sceneGraph.diagnostics, generatedAt: '2026-06-15T00:00:01.000Z' },
        },
        debugImages: {},
      };
    },
    queryJson: async () => ({ model: 'qwen2.5vl:7b', value: [] }),
  });
  setRenderSvgHookForTests(async () => Buffer.from('rendered-png'));

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageCompare({
      params: { attachmentId: imageAttachment.id },
      body: { format: 'svg', content: '<svg viewBox="0 0 10 10"></svg>', iteration: 1, maxIterations: 3 },
    } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { comparison: { format: string } }).comparison.format, 'svg');
  } finally {
    setImageAnalysisTestHooksForTests({});
    setRenderSvgHookForTests(null);
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
