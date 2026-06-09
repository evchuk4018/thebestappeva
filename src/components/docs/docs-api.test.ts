import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDocPreferences, saveDoc } from './docs-api';
import type { DocBundle } from './docs-types';

const sampleBundle: DocBundle = {
  doc: {
    id: 'doc-1',
    title: 'Draft',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    lastOpenedAt: '2026-06-08T00:00:00.000Z',
    starred: false,
    trashedAt: null,
    templateId: 'blank',
    activeTabId: 'tab-1',
    layoutMode: 'pages',
    zoom: 100,
    pageSettings: {
      paperSize: 'Letter',
      orientation: 'portrait',
      pageColor: '#0b0c0f',
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
    },
  },
  tabs: [{
    id: 'tab-1',
    docId: 'doc-1',
    parentTabId: null,
    title: 'Tab 1',
    order: 0,
    outlineVisible: true,
    content: '<p>Hello</p>',
    contentFormat: 'html',
    textContent: 'Hello',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
  }],
  versions: [],
  nextVersionCursor: null,
  citations: [],
};

test('saveDoc sends keepalive PUT requests to the docs API', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let request: RequestInit | undefined;
  let url = '';

  globalThis.window = { location: { origin: 'http://127.0.0.1:4173' } } as Window & typeof globalThis;
  globalThis.fetch = async (input, init) => {
    url = String(input);
    request = init;
    return new Response(JSON.stringify(sampleBundle), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const saved = await saveDoc({ doc: sampleBundle.doc, tab: sampleBundle.tabs[0], version: { kind: 'auto', label: 'Autosave' } }, { keepalive: true });
    assert.equal(url, '/api/docs/doc-1');
    assert.equal(request?.method, 'PUT');
    assert.equal(request?.keepalive, true);
    assert.equal(saved.doc.id, 'doc-1');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});

test('loads docs preferences from the server response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ preferences: { sort: 'updatedAt', showTemplates: false } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const preferences = await loadDocPreferences();
    assert.deepEqual(preferences, { sort: 'updatedAt', showTemplates: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
