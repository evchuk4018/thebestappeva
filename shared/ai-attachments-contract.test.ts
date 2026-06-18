import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiAttachmentContextPayload, parseAiParsedAttachment } from './ai-attachments-contract';

test('parses an image attachment record', () => {
  const payload = parseAiParsedAttachment({
    id: 'image_abc123',
    kind: 'image',
    createdAt: '2026-06-15T00:00:00.000Z',
    fileName: 'map.png',
    mediaType: 'image/png',
    fileSize: 256,
    width: 640,
    height: 480,
    summary: 'A labeled road map with a highlighted route.',
    summaryModel: 'qwen2.5vl:7b',
    summaryStatus: 'ready',
    summaryMetadata: {
      mode: 'offline',
      provider: 'local',
      model: 'qwen2.5vl:7b',
      fallbackUsed: false,
      latencyMs: 12,
    },
    analysisStatus: 'ready',
    analysisVersion: 'scene-graph-v1',
    analysisUpdatedAt: '2026-06-15T01:00:00.000Z',
  });

  assert.equal(payload.kind, 'image');
  assert.equal(payload.id, 'image_abc123');
  assert.equal(payload.summaryModel, 'qwen2.5vl:7b');
  assert.equal(payload.summaryMetadata?.provider, 'local');
  assert.equal(payload.analysisStatus, 'ready');
});

test('document context payload rejects image attachments', () => {
  assert.throws(
    () => parseAiAttachmentContextPayload({
      attachment: {
        id: 'image_abc123',
        kind: 'image',
        createdAt: '2026-06-15T00:00:00.000Z',
        fileName: 'map.png',
        mediaType: 'image/png',
        fileSize: 256,
        summary: 'A map.',
        summaryModel: 'qwen2.5vl:7b',
        summaryStatus: 'ready',
      },
      context: 'not used',
      mode: 'inline',
      selectedChunkCount: 0,
    }),
    /Expected a document attachment/,
  );
});
