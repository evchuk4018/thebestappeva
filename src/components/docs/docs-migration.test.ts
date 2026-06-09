import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateLegacyDocsStorage } from './docs-migration';

const samplePayload = {
  sourceKey: 'browser-a',
  docs: [{
    id: 'doc-1',
    title: 'Draft',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
    lastOpenedAt: '2026-06-08T00:00:00.000Z',
    starred: false,
    trashedAt: null,
    templateId: 'blank',
    activeTabId: 'tab-1',
    layoutMode: 'pages' as const,
    zoom: 100,
    pageSettings: { paperSize: 'Letter' as const, orientation: 'portrait' as const, pageColor: '#0b0c0f', margins: { top: 72, right: 72, bottom: 72, left: 72 } },
  }],
  tabs: [{
    id: 'tab-1',
    docId: 'doc-1',
    parentTabId: null,
    title: 'Tab 1',
    order: 0,
    outlineVisible: true,
    content: '<p>Hello</p>',
    contentFormat: 'html' as const,
    textContent: 'Hello',
    createdAt: '2026-06-08T00:00:00.000Z',
    updatedAt: '2026-06-08T00:00:00.000Z',
  }],
  versions: [],
  citations: [],
  preferences: { sort: 'lastOpenedAt' as const, showTemplates: true },
};

test('imports legacy docs data and only cleans up after success', async () => {
  let cleanedUp = false;
  let removedSourceKey = false;
  let importedPayload = null;

  await migrateLegacyDocsStorage({
    cleanupLegacyData: async () => { cleanedUp = true; },
    fetchStatus: async () => ({ migrated: false }),
    importData: async (payload) => { importedPayload = payload; },
    loadLegacyData: async () => samplePayload,
    readSourceKey: () => 'browser-a',
    removeSourceKey: () => { removedSourceKey = true; },
    writeSourceKey: () => { throw new Error('writeSourceKey should not run when a key already exists'); },
  });

  assert.equal(cleanedUp, true);
  assert.equal(removedSourceKey, true);
  assert.deepEqual(importedPayload, samplePayload);
});

test('preserves legacy storage when migration import fails', async () => {
  let cleanedUp = false;
  let removedSourceKey = false;

  await assert.rejects(() => migrateLegacyDocsStorage({
    cleanupLegacyData: async () => { cleanedUp = true; },
    fetchStatus: async () => ({ migrated: false }),
    importData: async () => { throw new Error('Import failed'); },
    loadLegacyData: async () => samplePayload,
    readSourceKey: () => 'browser-a',
    removeSourceKey: () => { removedSourceKey = true; },
    writeSourceKey: () => undefined,
  }), /Import failed/);

  assert.equal(cleanedUp, false);
  assert.equal(removedSourceKey, false);
});
