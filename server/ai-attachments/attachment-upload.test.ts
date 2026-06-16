import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { serverConfig } from '../config';
import { parseIncomingAttachment } from './attachment-upload';

test('image uploads get image_* ids and an immediate summary', async () => {
  const originalFetch = globalThis.fetch;
  const originalStoragePath = serverConfig.aiAttachmentStoragePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-upload-'));
  serverConfig.aiAttachmentStoragePath = tempDir;
  const requests: Array<{ url: string; body: string }> = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === 'string' ? init.body : '';
    requests.push({ url, body });

    if (url.endsWith('/api/tags')) {
      return new Response(JSON.stringify({ models: [] }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.endsWith('/api/pull')) {
      return new Response('{"status":"success"}\n', { headers: { 'Content-Type': 'application/x-ndjson' } });
    }

    return new Response(JSON.stringify({ message: { content: 'A street map with route labels.' } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const record = await parseIncomingAttachment({
      body: {
        fileName: 'map.png',
        contentType: 'image/png',
        base64Data: Buffer.from('fake-image').toString('base64'),
        width: 640,
        height: 480,
      },
    } as never);

    assert.equal(record.attachment.kind, 'image');
    assert.match(record.attachment.id, /^image_[a-z0-9]{12}$/);
    assert.equal(record.attachment.summary, 'A street map with route labels.');
    assert.equal(record.attachment.width, 640);
    assert.equal(record.attachment.analysisStatus, 'idle');
    assert.match(requests[1]?.body ?? '', /qwen3vl:8b/);
    await assert.doesNotReject(fs.access(path.join(tempDir, `${record.attachment.id}.json`)));
    await assert.doesNotReject(fs.access(path.join(tempDir, `${record.attachment.id}.png`)));
  } finally {
    globalThis.fetch = originalFetch;
    serverConfig.aiAttachmentStoragePath = originalStoragePath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
