import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { serverConfig } from '../config';
import { handlePostAiImageQuestion } from './image-routes';
import { saveAttachmentRecord, saveAttachmentSource } from './storage';

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

    return new Response(JSON.stringify({ message: { content: 'Yes, it is a map.' } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const attachment = {
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
    };
    await saveAttachmentSource(attachment.id, '.png', Buffer.from('fake-image'));
    await saveAttachmentRecord({ attachment, sourceExtension: '.png' });

    const response = createResponseCapture();
    await handlePostAiImageQuestion({
      params: { attachmentId: attachment.id },
      body: { question: 'Is this image a map?' },
    } as never, response as never);

    assert.equal(response.statusCode, 200);
    assert.equal((response.body as { answer?: string }).answer, 'Yes, it is a map.');
    assert.match(fetchBodies[1] ?? '', /Is this image a map\?/);
    assert.match(fetchBodies[1] ?? '', /ZmFrZS1pbWFnZQ==/);
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('image query route rejects document attachments', async () => {
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-query-doc-'));
  serverConfig.aiAttachmentStoragePath = tempDir;

  try {
    await saveAttachmentSource('doc-1', '.pdf', Buffer.from('fake-pdf'));
    await saveAttachmentRecord({
      attachment: {
        id: 'doc-1',
        kind: 'document',
        createdAt: '2026-06-15T00:00:00.000Z',
        fileName: 'brief.pdf',
        mediaType: 'application/pdf',
        fileSize: 12,
        parser: 'docling',
        title: 'Brief',
        textChars: 12,
        chunkCount: 1,
        warningCount: 0,
        pageCount: 1,
        pdfReaderMode: 'inline',
        outline: [],
        warnings: [],
        stats: { pageCount: 1, sheetCount: null },
        previewText: 'Preview',
      },
      markdown: '# Brief',
      text: 'Brief',
      chunks: [{ id: 'chunk-1', heading: null, text: 'Brief' }],
      sourceExtension: '.pdf',
    });

    const response = createResponseCapture();
    await handlePostAiImageQuestion({
      params: { attachmentId: 'doc-1' },
      body: { question: 'What is this?' },
    } as never, response as never);

    assert.equal(response.statusCode, 415);
  } finally {
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
