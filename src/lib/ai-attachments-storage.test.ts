import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAiPdfPage } from './ai-attachments-storage';

test('reports stale HTML API responses before contract parsing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<!doctype html><title>App</title>');

  try {
    await assert.rejects(
      () => loadAiPdfPage('pdf-1', 1),
      /local API returned HTML instead of JSON.*Restart the development server/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports unsuccessful JSON payloads even with a 200 response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: 'Route unavailable.' }));

  try {
    await assert.rejects(() => loadAiPdfPage('pdf-1', 1), /Route unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
