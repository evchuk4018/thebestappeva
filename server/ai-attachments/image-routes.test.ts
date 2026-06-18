import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { AiImageSceneGraph } from '../../shared/ai-image-bridge-contract';
import { serverConfig } from '../config';
import { HttpError } from '../http';
import { handlePostAiImageAnalysis, handlePostAiImageCompare, handlePostAiImageDescribe, handlePostAiImageQuestion } from './image-routes';
import { saveAttachmentRecord, saveAttachmentSource } from './storage';
import { setImageAnalysisTestHooksForTests } from './image-analysis-service';
import { setRenderSvgHookForTests } from './image-compare-service';
import { setImageToolLogSinkForTests, setImageToolTimingForTests } from './image-tool-runtime';
import { setVisionServiceTestHooksForTests } from './vision-service';

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
  summaryMetadata: {
    mode: 'offline' as const,
    provider: 'local' as const,
    model: 'qwen2.5vl:7b',
    fallbackUsed: false,
    latencyMs: 12,
  },
  analysisStatus: 'idle' as const,
};

const sceneGraph: AiImageSceneGraph = {
  canvas: { width: 640, height: 480, background: '#ffffff' },
  objects: [
    { id: 'obj_1', type: 'rectangle', label: 'left_zone', bbox: [0, 0, 120, 120], dominantColors: ['#ff0000'], fill: '#ff0000', stroke: '#000000', crops: ['full', 'left'], confidence: 0.9 },
    { id: 'obj_2', type: 'line', label: 'divider', bbox: [121, 0, 123, 120], line: [122, 0, 122, 120], dominantColors: ['#000000'], fill: '#000000', stroke: '#000000', crops: ['full', 'center'], confidence: 0.92 },
  ],
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

test.afterEach(() => {
  setImageToolLogSinkForTests(null);
  setImageToolTimingForTests(null);
});

test('image query route sends stored image bytes plus the question to Ollama', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-query-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  const calls: string[] = [];
  setVisionServiceTestHooksForTests({
    mode: 'offline',
    localProvider: {
      provider: 'local',
      async healthCheck() {
        return { available: true, provider: 'local', detail: 'ready' };
      },
      async describeImage() {
        calls.push('describe');
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'A street map.' };
      },
      async answerImageQuestion(_image, question) {
        calls.push(question);
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Yes, it is a map.' };
      },
    },
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageQuestion({ params: { attachmentId: imageAttachment.id }, body: { question: 'Is this image a map?' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { answer?: string }).answer, 'Yes, it is a map.');
    assert.equal((response.body as { metadata: { provider: string } }).metadata.provider, 'local');
    assert.equal(calls[0], 'Is this image a map?');
  } finally {
    setVisionServiceTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image describe route returns provider metadata', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-describe-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  setVisionServiceTestHooksForTests({
    mode: 'online',
    onlineProvider: {
      provider: 'gemini',
      async healthCheck() {
        return { available: true, provider: 'gemini', detail: 'ready' };
      },
      async describeImage() {
        return {
          provider: 'gemini',
          model: 'gemini-2.5-flash-lite',
          text: 'A map with a highlighted route.',
          inputTokens: 120,
          outputTokens: 30,
          totalTokens: 150,
          estimatedCostUsd: 0.000075,
        };
      },
      async answerImageQuestion() {
        throw new Error('Not used in this test.');
      },
    },
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageDescribe({ params: { attachmentId: imageAttachment.id }, body: {} } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { summary?: string }).summary, 'A map with a highlighted route.');
    assert.equal((response.body as { metadata: { provider: string } }).metadata.provider, 'gemini');
  } finally {
    setVisionServiceTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image-analysis route returns cached or freshly analyzed scene graphs', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-analysis-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  let analyzeCalls = 0;
  setImageAnalysisTestHooksForTests({
    analyzeFile: async () => {
      analyzeCalls += 1;
      return { sceneGraph, debugImages: {} };
    },
    queryJson: async () => ({ model: 'qwen2.5vl:7b', value: [{ id: 'obj_1', label: 'left_zone', type: 'rectangle', confidence: 0.95 }] }),
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const first = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true, detail: 'semantic' } } as never, first as never);
    assert.equal(first.statusCode, 200);
    assert.equal((first.body as { cached: boolean }).cached, false);
    assert.equal((first.body as { detail: string }).detail, 'semantic');
    assert.deepEqual((first.body as { sceneGraph: AiImageSceneGraph }).sceneGraph.objects[1]?.line, [122, 0, 122, 120]);

    const second = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { detail: 'semantic' } } as never, second as never);
    assert.equal((second.body as { cached: boolean }).cached, true);
    assert.equal(analyzeCalls, 1);

    const layout = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: {} } as never, layout as never);
    assert.equal((layout.body as { detail: string }).detail, 'layout');
    assert.equal((layout.body as { cached: boolean }).cached, false);

    const refreshed = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true, detail: 'semantic' } } as never, refreshed as never);
    assert.equal((refreshed.body as { cached: boolean }).cached, false);
    assert.equal(analyzeCalls, 3);
  } finally {
    setImageAnalysisTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image-analysis route retries one timed-out semantic extraction and logs the stalled provider stage', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-analysis-retry-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  const logs: Array<{ stage: string; attempt?: number; finalStatus?: string }> = [];
  let semanticCalls = 0;
  setImageToolTimingForTests({ attemptTimeoutMs: 10, retryDelayMs: 1, totalTimeoutMs: 40 });
  setImageToolLogSinkForTests((record) => {
    logs.push({ stage: record.stage, attempt: record.attempt, finalStatus: record.finalStatus });
  });
  setImageAnalysisTestHooksForTests({
    analyzeFile: async () => ({ sceneGraph, debugImages: { contact: Buffer.from('debug') } }),
    queryJson: async (_image, _instructions, _parser, options) => {
      semanticCalls += 1;
      if (semanticCalls === 1) {
        return await new Promise<never>((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
        });
      }
      return { model: 'qwen2.5vl:7b', value: [{ id: 'obj_1', label: 'left_zone', type: 'rectangle', confidence: 0.95 }] };
    },
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true, detail: 'semantic' } } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.equal(semanticCalls, 2);
    assert.equal(logs.some((entry) => entry.stage === 'provider_request_started' && entry.attempt === 1), true);
    assert.equal(logs.some((entry) => entry.stage === 'provider_response_received' && entry.attempt === 1), false);
    assert.equal(logs.some((entry) => entry.stage === 'timeout' && entry.attempt === 1 && entry.finalStatus === 'retrying'), true);
    assert.equal(logs.some((entry) => entry.stage === 'retry_started' && entry.attempt === 2), true);
  } finally {
    setImageToolLogSinkForTests(null);
    setImageAnalysisTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image-analysis route fails permanently after two timed-out attempts', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-analysis-timeout-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  setImageToolTimingForTests({ attemptTimeoutMs: 10, retryDelayMs: 1, totalTimeoutMs: 40 });
  setImageAnalysisTestHooksForTests({
    analyzeFile: async () => ({ sceneGraph, debugImages: { contact: Buffer.from('debug') } }),
    queryJson: async (_image, _instructions, _parser, options) => {
      return await new Promise<never>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
      });
    },
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true, detail: 'semantic' } } as never, response as never);

    assert.equal(response.statusCode, 504);
    assert.match(String((response.body as { error?: string }).error ?? ''), /timed out after two attempts/i);
  } finally {
    setImageAnalysisTestHooksForTests({});
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image-analysis route does not retry permanent 400 failures and deduplicates concurrent matching refresh requests', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-analysis-dedupe-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  let analyzeCalls = 0;
  let releaseGate: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  setImageAnalysisTestHooksForTests({
    analyzeFile: async () => {
      analyzeCalls += 1;
      await gate;
      return { sceneGraph, debugImages: { contact: Buffer.from('debug') } };
    },
    queryJson: async () => {
      throw new HttpError(400, 'Bad image request.');
    },
  });

  try {
    await saveAttachmentSource(imageAttachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment: imageAttachment, sourceExtension: '.png' });

    const first = createResponseCapture();
    const second = createResponseCapture();
    const pending = Promise.all([
      handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true, detail: 'semantic' } } as never, first as never),
      handlePostAiImageAnalysis({ params: { attachmentId: imageAttachment.id }, body: { refresh: true, detail: 'semantic' } } as never, second as never),
    ]);
    releaseGate?.();
    await pending;

    assert.equal(first.statusCode, 400);
    assert.equal(second.statusCode, 400);
    assert.equal(analyzeCalls, 1);
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
