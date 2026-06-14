import assert from 'node:assert/strict';
import test from 'node:test';
import { toPersistedToolResult } from './result-persistence';

test('removes PDF page payloads before chat persistence', () => {
  const persisted = toPersistedToolResult({
    toolId: 'pdf-reader',
    functionName: 'view_pdf_page',
    ok: true,
    summary: 'Rendered page 4.',
    data: {
      base64Data: 'large-image-data',
      text: 'Extracted page text',
    },
  });

  assert.equal(persisted.toolId, 'pdf-reader');
  assert.equal(persisted.functionName, 'view_pdf_page');
  assert.equal(persisted.ok, true);
  assert.equal(persisted.summary, 'Rendered page 4.');
  assert.equal(persisted.error, undefined);
  assert.equal('toolCallId' in persisted, false);
  assert.equal('data' in persisted, false);
});

test('keeps ordinary tool result payloads', () => {
  const result = {
    toolId: 'weather',
    functionName: 'get_weather',
    ok: true,
    summary: 'Weather loaded.',
    data: { temperature: 72 },
  };
  assert.equal(toPersistedToolResult(result), result);
});
