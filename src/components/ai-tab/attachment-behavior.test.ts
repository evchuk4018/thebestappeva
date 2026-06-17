import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDefaultAttachmentPrompt, resolveTurnMode } from './attachment-behavior';
import type { AiAttachmentReference, Chat } from './types';

const imageAttachment: AiAttachmentReference = {
  id: 'image_map123',
  kind: 'image',
  fileName: 'map.png',
  mediaType: 'image/png',
  fileSize: 200,
  summary: 'A road map with labels and a blue route.',
  summaryModel: 'qwen2.5vl:7b',
  summaryStatus: 'ready',
};

const documentAttachment: AiAttachmentReference = {
  id: 'doc-1',
  kind: 'document',
  fileName: 'brief.pdf',
  mediaType: 'application/pdf',
  fileSize: 200,
  parser: 'docling',
  title: 'Brief',
  textChars: 100,
  chunkCount: 1,
  warningCount: 0,
  pageCount: 6,
  pdfReaderMode: 'tool',
};

function createChat(attachments: AiAttachmentReference[], content = 'Check this'): Chat {
  return {
    id: 'chat-1',
    title: 'Chat',
    titleStatus: 'generated',
    messages: [{ id: 'msg-1', kind: 'user', content, attachments, createdAt: '2026-06-15T00:00:00.000Z' }],
    activeArtifactId: null,
    includedArtifactIds: [],
    mode: 'flash',
    updatedAt: '2026-06-15T00:00:00.000Z',
  };
}

test('image-only attachments default to a semantic image prompt', () => {
  assert.match(buildDefaultAttachmentPrompt([imageAttachment]), /attached image/i);
});

test('exact image turns force thinking for every provider', () => {
  const chat = createChat([imageAttachment], 'Read the text and count the labels in this UI screenshot.');
  assert.equal(resolveTurnMode(chat, 'deepseek', 'flash'), 'thinking');
  assert.equal(resolveTurnMode(chat, 'ollama', 'flash'), 'thinking');
});

test('vague image turns can stay in flash mode', () => {
  const chat = createChat([imageAttachment], 'What is visible here?');
  assert.equal(resolveTurnMode(chat, 'ollama', 'flash'), 'flash');
});

test('long document attachments still force thinking', () => {
  assert.equal(resolveTurnMode(createChat([documentAttachment]), 'ollama', 'flash'), 'thinking');
});
