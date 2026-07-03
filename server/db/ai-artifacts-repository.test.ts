import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createAiArtifactsRepository } from './ai-artifacts-repository';
import { createDocsRepository } from './docs-repository';

function createTestRepositories() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  const docsRepo = createDocsRepository(database);
  return {
    database,
    docsRepo,
    artifactsRepo: createAiArtifactsRepository(database, { docsRepo }),
  };
}

test('creates, updates, searches, and restores artifact history', () => {
  const { artifactsRepo } = createTestRepositories();
  const created = artifactsRepo.createArtifact('chat-1', {
    title: 'Project brief',
    type: 'brief',
    content: '# Intro\nAlpha line\n\n## Plan\nBeta line',
    contextPolicy: { mode: 'chunked', maxChars: 1000 },
  });

  assert.equal(artifactsRepo.listArtifacts('chat-1', true).length, 1);
  assert.equal(created.title, 'Project brief');
  assert.equal(artifactsRepo.fetchArtifactLines('chat-1', created.artifactId, 1, 2).lines[1], 'Alpha line');
  assert.equal(artifactsRepo.searchArtifact('chat-1', created.artifactId, 'Beta', 'keyword').matches[0]?.lineStart, 5);
  assert.equal(artifactsRepo.getOutline('chat-1', created.artifactId).outline[1]?.heading, 'Plan');

  const updated = artifactsRepo.updateArtifact('chat-1', {
    artifactId: created.artifactId,
    patch: { mode: 'replace_lines', startLine: 2, endLine: 2, text: 'Gamma line' },
    reason: 'Revise opening',
  });
  assert.equal(updated.artifact.content.includes('Gamma line'), true);
  assert.equal(updated.historyVersionId?.startsWith('artifact-version-'), true);
  assert.equal(artifactsRepo.listVersions('chat-1', created.artifactId).length, 1);

  const restored = artifactsRepo.restoreVersion('chat-1', created.artifactId, artifactsRepo.listVersions('chat-1', created.artifactId)[0].versionId);
  assert.equal(restored.content.includes('Alpha line'), true);
});

test('supports structured table edits and linked docs export', () => {
  const { artifactsRepo, docsRepo } = createTestRepositories();
  const created = artifactsRepo.createArtifact('chat-1', {
    title: 'Spec table',
    type: 'spec',
    content: '## Table\n| Name | Status |\n| --- | --- |\n| API | Draft |',
    contextPolicy: { mode: 'chunked' },
  });

  const tableUpdate = artifactsRepo.updateArtifactTable('chat-1', {
    artifactId: created.artifactId,
    tableLocator: { heading: 'Table', tableIndex: 0 },
    operation: 'insert_column_right',
    columnIndex: 0,
    reason: 'Add owner column',
  });
  assert.equal(tableUpdate.artifact.content.includes('| Name | Column | Status |'), true);

  const firstExport = artifactsRepo.exportArtifactToDoc('chat-1', created.artifactId, { mode: 'create_or_update_linked' });
  assert.equal(firstExport.action, 'created');
  assert.equal(docsRepo.listDocs().length, 1);

  const secondExport = artifactsRepo.exportArtifactToDoc('chat-1', created.artifactId, { mode: 'create_or_update_linked', title: 'Spec table v2' });
  assert.equal(secondExport.action, 'updated');
  assert.equal(secondExport.docId, firstExport.docId);
  assert.equal(artifactsRepo.getArtifact('chat-1', created.artifactId)?.linkedDocId, firstExport.docId);
});

test('scopes artifact reads, updates, versions, and deletes by owner', () => {
  const { database, docsRepo } = createTestRepositories();
  const canonicalRepo = createAiArtifactsRepository(database, { docsRepo });
  const otherDocsRepo = createDocsRepository(database, 'other-owner');
  const otherRepo = createAiArtifactsRepository(database, { docsRepo: otherDocsRepo, ownerId: 'other-owner' });

  const canonicalArtifact = canonicalRepo.createArtifact('chat-1', {
    title: 'Mine',
    type: 'markdown',
    content: 'Alpha',
    contextPolicy: { mode: 'chunked' },
  });
  const otherArtifact = otherRepo.createArtifact('chat-1', {
    title: 'Theirs',
    type: 'markdown',
    content: 'Beta',
    contextPolicy: { mode: 'chunked' },
  });

  assert.deepEqual(canonicalRepo.listArtifacts('chat-1').map((artifact) => artifact.artifactId), [canonicalArtifact.artifactId]);
  assert.equal(canonicalRepo.getArtifact('chat-1', otherArtifact.artifactId), null);
  assert.deepEqual(canonicalRepo.listVersions('chat-1', otherArtifact.artifactId), []);
  assert.throws(() => canonicalRepo.updateArtifact('chat-1', { artifactId: otherArtifact.artifactId, content: 'Gamma', reason: 'Nope' }), /was not found/i);

  canonicalRepo.deleteArtifact('chat-1', otherArtifact.artifactId);

  assert.equal(otherRepo.getArtifact('chat-1', otherArtifact.artifactId)?.title, 'Theirs');
});
