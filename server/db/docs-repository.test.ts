import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createDocsRepository } from './docs-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  return { database, repository: createDocsRepository(database) };
}

test('creates docs schema tables and indexes', () => {
  const { database } = createTestRepository();
  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'docs_%' ORDER BY name`).all() as Array<{ name: string }>;
  const indexes = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_docs_%' ORDER BY name`).all() as Array<{ name: string }>;
  assert.deepEqual(tables.map((entry) => entry.name), ['docs_citations', 'docs_documents', 'docs_migration_sources', 'docs_tabs', 'docs_versions']);
  assert.deepEqual(indexes.map((entry) => entry.name), ['idx_docs_citations_owner_document_id', 'idx_docs_documents_owner_updated_at', 'idx_docs_tabs_owner_document_id', 'idx_docs_versions_owner_document_created']);
});

test('supports document CRUD, tab reorder, and citations', () => {
  const { repository } = createTestRepository();
  const created = repository.createDoc('blank');
  assert.equal(repository.listDocs().length, 1);

  const reversedTabs = created.tabs.map((tab, index, tabs) => ({ ...tabs[tabs.length - index - 1], order: index, updatedAt: new Date().toISOString() }));
  const reordered = repository.saveTabs(reversedTabs);
  assert.equal(reordered?.tabs[0].id, reversedTabs[0].id);

  const citations = repository.saveCitations(created.doc.id, [{ id: 'citation-1', label: 'Source', details: 'Publisher, 2026.' }]);
  assert.equal(citations.length, 1);

  const renamed = repository.setDocField(created.doc.id, (doc) => ({ ...doc, title: 'Renamed doc', updatedAt: new Date().toISOString() }));
  assert.equal(renamed?.doc.title, 'Renamed doc');

  repository.deleteDoc(created.doc.id);
  assert.equal(repository.listDocs().length, 0);
});

test('retains unlimited autosaves and paginates version history', () => {
  const { repository } = createTestRepository();
  let bundle = repository.createDoc('blank');
  let activeTab = bundle.tabs[0];

  for (let index = 0; index < 55; index += 1) {
    activeTab = { ...activeTab, content: `<p>Version ${index}</p>`, textContent: `Version ${index}`, updatedAt: new Date(Date.now() + index).toISOString() };
    bundle = repository.saveDoc({
      doc: { ...bundle.doc, updatedAt: new Date(Date.now() + index).toISOString(), lastOpenedAt: new Date(Date.now() + index).toISOString() },
      tab: activeTab,
      version: { kind: 'auto', label: `Autosave ${index}` },
    });
  }

  const firstPage = repository.listVersions(bundle.doc.id, null, 25);
  const secondPage = repository.listVersions(bundle.doc.id, firstPage.nextCursor, 25);
  const thirdPage = repository.listVersions(bundle.doc.id, secondPage.nextCursor, 25);
  assert.equal(firstPage.versions.length, 25);
  assert.equal(secondPage.versions.length, 25);
  assert.equal(thirdPage.versions.length, 5);
  assert.equal(firstPage.versions[0].label, 'Autosave 54');
  assert.equal(thirdPage.versions.at(-1)?.label, 'Autosave 0');
});

test('restores a prior version snapshot into the active tab', () => {
  const { repository } = createTestRepository();
  let bundle = repository.createDoc('blank');
  const originalTab = bundle.tabs[0];
  bundle = repository.saveDoc({
    doc: { ...bundle.doc, updatedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() },
    tab: { ...originalTab, content: '<p>Changed</p>', textContent: 'Changed', updatedAt: new Date().toISOString() },
    version: { kind: 'named', label: 'Changed snapshot' },
  });

  const restored = repository.restoreVersion(bundle.doc.id, bundle.versions[0].id);
  assert.ok(restored);
  assert.equal(restored?.tabs[0].content, '<p>Changed</p>');
  assert.equal(restored?.versions[0].kind, 'restore');
});

test('imports migrations idempotently and rolls back invalid payloads', () => {
  const { repository } = createTestRepository();
  const source = repository.createDoc('blank');
  const payload = {
    sourceKey: 'browser-a',
    docs: [source.doc],
    tabs: source.tabs,
    versions: [],
    citations: [{ id: 'citation-1', docId: source.doc.id, label: 'Source', details: 'Publisher, 2026.' }],
    preferences: { sort: 'updatedAt' as const, showTemplates: false },
  };

  repository.importMigration(payload);
  repository.importMigration(payload);
  assert.equal(repository.listDocs().length, 1);
  assert.equal(repository.loadPreferences().sort, 'updatedAt');
  assert.equal(repository.hasMigration('browser-a'), true);

  assert.throws(() => repository.importMigration({
    ...payload,
    sourceKey: 'browser-b',
    versions: [{ id: 'version-bad', docId: 'missing-doc', tabId: null, createdAt: new Date().toISOString(), label: 'Bad', kind: 'auto', content: '<p>x</p>', contentFormat: 'html', snapshotTitle: 'Bad' }],
  }), /invalid document relationships/);
  assert.equal(repository.hasMigration('browser-b'), false);
});

test('scopes document reads, writes, and deletes by owner', () => {
  const { database, repository } = createTestRepository();
  const otherRepository = createDocsRepository(database, 'other-owner');
  const canonical = repository.createDoc('blank');
  const other = otherRepository.createDoc('blank');

  assert.equal(repository.getDocBundle(other.doc.id), null);
  assert.equal(repository.listDocs().length, 1);
  assert.equal(otherRepository.listDocs().length, 1);

  repository.deleteDoc(other.doc.id);
  assert.equal(otherRepository.getDocBundle(other.doc.id)?.doc.id, other.doc.id);

  const updated = repository.saveCitations(canonical.doc.id, [{ id: 'citation-1', label: 'Only mine', details: 'Details' }]);
  assert.equal(updated.length, 1);
  assert.equal(otherRepository.getDocBundle(other.doc.id)?.citations.length, 0);
});
