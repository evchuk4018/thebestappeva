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

test('ask_image_model proxies the focused image question to the server route', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    attachment: { ...attachment, createdAt: '2026-06-15T00:00:00.000Z' },
    answer: 'Yes, the image is a labeled street map.',
    question: 'Is this image a map?',
    model: 'qwen2.5vl:7b',
  }), { headers: { 'Content-Type': 'application/json' } });

  try {
    const tool = createImageBridgeTool([attachment]);
    const result = await tool.execute({
      toolId: 'image-bridge',
      functionName: 'ask_image_model',
      args: { imageId: attachment.id, question: 'Is this image a map?' },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {});

    if ('deferred' in result) {
      assert.fail('Expected an immediate tool result.');
    }

    assert.equal(result.ok, true);
    assert.equal(result.data?.imageId, attachment.id);
    assert.equal(result.data?.model, 'qwen2.5vl:7b');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ask_image_model rejects image ids that are not attached to the chat', async () => {
  const tool = createImageBridgeTool([attachment]);
  await assert.rejects(
    () => tool.execute({
      toolId: 'image-bridge',
      functionName: 'ask_image_model',
      args: { imageId: 'doc-1', question: 'What is this?' },
      createdAt: '2026-06-15T00:00:00.000Z',
    }, {}),
    /not available in this chat/,
  );
});
