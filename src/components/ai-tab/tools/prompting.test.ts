import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlainModelMessages } from './prompting';

const imageA = {
  id: 'image_map123',
  kind: 'image' as const,
  fileName: 'map.png',
  mediaType: 'image/png',
  fileSize: 200,
  summary: 'A map with roads and labels.',
  summaryModel: 'qwen2.5vl:7b',
  summaryStatus: 'ready' as const,
};

const imageB = {
  id: 'image_chart456',
  kind: 'image' as const,
  fileName: 'chart.png',
  mediaType: 'image/png',
  fileSize: 220,
  summary: 'A chart with red and blue bars.',
  summaryModel: 'qwen2.5vl:7b',
  summaryStatus: 'ready' as const,
};

const promptContext = {
  generatedUserMemory: '',
  customPrompt: '',
  mode: 'thinking' as const,
  tools: [],
};

test('image prompts include structured scene extraction guidance for each image', async () => {
  const messages = await buildPlainModelMessages([{
    id: 'msg-1',
    kind: 'user',
    content: 'Compare these images.',
    attachments: [imageA, imageB],
    createdAt: '2026-06-15T00:00:00.000Z',
  }], promptContext, 'deepseek');

  const userMessage = messages[1]?.content ?? '';
  assert.match(userMessage, /User uploaded image image_map123/);
  assert.match(userMessage, /User uploaded image image_chart456/);
  assert.match(userMessage, /call extract_image_scene with detail "layout"/);
  assert.match(userMessage, /Use compare_generated_image only after you have a candidate SVG/);
  assert.doesNotMatch(userMessage, /ask_image_model/);
});

test('non-deepseek image prompts also include structured evidence instructions', async () => {
  const messages = await buildPlainModelMessages([{
    id: 'msg-1',
    kind: 'user',
    content: 'Describe this.',
    attachments: [imageA],
    createdAt: '2026-06-15T00:00:00.000Z',
  }], promptContext, 'ollama');

  const userMessage = messages[1]?.content ?? '';
  assert.match(userMessage, /Initial image summary:\s+A map with roads and labels\./);
  assert.match(userMessage, /Structured image evidence/);
  assert.doesNotMatch(userMessage, /ask_image_model/);
});
