import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { parseAiWorkspaceSnapshot, type AiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
import { createPostgresAiArtifactsRepository } from './postgres-ai-artifacts-repository';
import { createPostgresAiWorkspaceRepository, WorkspaceRevisionConflictError } from './postgres-ai-workspace-repository';
import { createPostgresDocsRepository } from './postgres-docs-repository';
import { assertSafePostgresTestDatabase } from './postgres-config';

const migrationsUrl = new URL('../../supabase/migrations/', import.meta.url);
const migrationFileNames = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql')).sort();
const migrationSqls = await Promise.all(migrationFileNames.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')));
const connectionString = process.env.POSTGRES_TEST_DATABASE_URL
  ?? 'postgresql://thebestappeva:thebestappeva_test@127.0.0.1:54323/thebestappeva_test';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

async function probePostgres() {
  try {
    assertSafePostgresTestDatabase(connectionString, 'POSTGRES_TEST_DATABASE_URL');
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 1000, max: 1 });
    await pool.query('SELECT 1');
    await pool.end();
    return null;
  } catch (error) {
    return `local test Postgres unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const skipReason = await probePostgres();

function postgresTest(name: string, fn: () => Promise<void>) {
  return skipReason ? test(name, { skip: skipReason }, fn) : test(name, fn);
}

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString, max: 4 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

async function resetDatabase(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS
      workspace_revision_state,
      docs_migration_sources,
      docs_citations,
      docs_versions,
      docs_tabs,
      docs_documents,
      ai_artifact_versions,
      ai_artifacts,
      ai_chats,
      app_settings
    CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
  `);
}

async function applyMigration(client: PoolClient) {
  for (const sql of migrationSqls) {
    await client.query(sql);
  }
}

async function applyFreshMigration(pool: Pool) {
  const client = await pool.connect();
  try {
    await resetDatabase(client);
    await applyMigration(client);
  } finally {
    client.release();
  }
}

function workspace(chats: AiWorkspaceSnapshot['chats'] = [], overrides: Partial<AiWorkspaceSnapshot> = {}) {
  return parseAiWorkspaceSnapshot({
    chats,
    generatedUserMemory: 'Prefers concise replies.',
    selectedProvider: 'ollama',
    selectedModel: 'qwen3.5:9b',
    visionMode: 'offline',
    enabledTools: { web_search: true },
    customSystemPrompt: 'Keep it tight.',
    ...overrides,
  });
}

function chat(id: string, updatedAt = '2026-06-12T00:00:00.000Z') {
  return {
    id,
    title: id,
    titleStatus: 'finalized' as const,
    messages: [],
    activeArtifactId: null,
    includedArtifactIds: [],
    mode: 'thinking' as const,
    updatedAt,
  };
}

postgresTest('workspace revisions reject stale writes and preserve owner isolation', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const ownerARepo = createPostgresAiWorkspaceRepository(ownerA, pool);
    const ownerBRepo = createPostgresAiWorkspaceRepository(ownerB, pool);

    await ownerARepo.saveAiWorkspace(workspace([chat('keep'), chat('remove')]), 0);
    await ownerBRepo.saveAiWorkspace(workspace([chat('remove')], { generatedUserMemory: 'Other owner memory.' }), 0);
    const loaded = await ownerARepo.loadAiWorkspace();

    const saved = await ownerARepo.saveAiWorkspace(workspace([chat('keep')], { generatedUserMemory: 'Updated memory.' }), loaded.revision);

    assert.equal(saved.revision, loaded.revision + 1);
    assert.deepEqual((await ownerARepo.loadAiWorkspace()).workspace.chats.map((entry) => entry.id), ['keep']);
    assert.deepEqual((await ownerBRepo.loadAiWorkspace()).workspace.chats.map((entry) => entry.id), ['remove']);
    assert.equal((await ownerARepo.loadAiWorkspace()).workspace.generatedUserMemory, 'Updated memory.');
    assert.equal((await ownerBRepo.loadGeneratedUserMemory()), 'Other owner memory.');

    await assert.rejects(
      () => ownerARepo.saveAiWorkspace(workspace([chat('stale')]), loaded.revision),
      (error) => error instanceof WorkspaceRevisionConflictError && error.statusCode === 409,
    );
    assert.deepEqual((await ownerARepo.loadAiWorkspace()).workspace.chats.map((entry) => entry.id), ['keep']);
  });
});

postgresTest('workspace writes are atomic, serialize JSONB, and reject concurrent stale saves', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const firstRepo = createPostgresAiWorkspaceRepository(ownerA, pool);
    const secondRepo = createPostgresAiWorkspaceRepository(ownerA, pool);
    await firstRepo.saveAiWorkspace(workspace([chat('initial')]), 0);

    const loaded = await firstRepo.loadAiWorkspace();
    const [first, second] = await Promise.allSettled([
      firstRepo.saveAiWorkspace(workspace([chat('first')], { enabledTools: { web_search: false, python_exec: true } }), loaded.revision),
      secondRepo.saveAiWorkspace(workspace([chat('second')]), loaded.revision),
    ]);
    const fulfilled = [first, second].filter((result) => result.status === 'fulfilled');
    const rejected = [first, second].filter((result) => result.status === 'rejected');

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal((rejected[0] as PromiseRejectedResult).reason.statusCode, 409);

    const afterConcurrent = await firstRepo.loadAiWorkspace();
    assert.equal(afterConcurrent.revision, 2);
    assert.equal(afterConcurrent.workspace.chats.length, 1);
    assert.deepEqual(afterConcurrent.workspace.enabledTools, afterConcurrent.workspace.chats[0]?.id === 'first' ? { web_search: false, python_exec: true } : { web_search: true });

    await assert.rejects(
      () => firstRepo.saveAiWorkspace(workspace([chat('partial-ok'), chat('bad-date', 'not-a-date')]), afterConcurrent.revision),
      /date|time|invalid/i,
    );
    assert.equal((await firstRepo.loadAiWorkspace()).revision, afterConcurrent.revision);
    assert.equal(await firstRepo.findChatById('partial-ok'), null);
  });
});

postgresTest('documents paginate versions and save compound doc/tab/version changes', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const repository = createPostgresDocsRepository(ownerA, pool);
    let bundle = await repository.createDoc('blank');
    let activeTab = bundle.tabs[0];

    for (let index = 0; index < 55; index += 1) {
      const updatedAt = new Date(Date.UTC(2026, 5, 12, 0, 0, index)).toISOString();
      activeTab = { ...activeTab, content: `<p>Version ${index}</p>`, textContent: `Version ${index}`, updatedAt };
      bundle = await repository.saveDoc({
        doc: { ...bundle.doc, title: `Doc ${index}`, updatedAt, lastOpenedAt: updatedAt },
        tab: activeTab,
        version: { kind: 'auto', label: `Autosave ${index}` },
      });
    }

    const firstPage = await repository.listVersions(bundle.doc.id, null, 25);
    const secondPage = await repository.listVersions(bundle.doc.id, firstPage.nextCursor, 25);
    const thirdPage = await repository.listVersions(bundle.doc.id, secondPage.nextCursor, 25);
    assert.equal(firstPage.versions.length, 25);
    assert.equal(secondPage.versions.length, 25);
    assert.equal(thirdPage.versions.length, 5);
    assert.equal(firstPage.versions[0].label, 'Autosave 54');

    const reloaded = await repository.getDocBundle(bundle.doc.id);
    assert.equal(reloaded?.doc.title, 'Doc 54');
    assert.equal(reloaded?.tabs[0].textContent, 'Version 54');
    assert.equal((await repository.getVersion(bundle.doc.id, firstPage.versions[0].id))?.content, '<p>Version 54</p>');
  });
});

postgresTest('artifacts create versions and roll back failed linked document exports', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const docsRepo = createPostgresDocsRepository(ownerA, pool);
    const artifactsRepo = createPostgresAiArtifactsRepository(ownerA, pool, { docsRepo });
    const otherArtifactsRepo = createPostgresAiArtifactsRepository(ownerB, pool);

    const artifact = await artifactsRepo.createArtifact('chat-1', {
      title: 'Project brief',
      type: 'brief',
      content: '# Intro\nAlpha',
      contextPolicy: { mode: 'chunked', maxChars: 1000 },
      citations: ['source-a'],
    });
    await otherArtifactsRepo.createArtifact('chat-1', {
      title: 'Other',
      type: 'brief',
      content: 'Other',
      contextPolicy: { mode: 'chunked' },
    });

    const updated = await artifactsRepo.updateArtifact('chat-1', {
      artifactId: artifact.artifactId,
      content: '# Intro\nBeta',
      reason: 'Revise',
    });
    assert.equal(updated.historyVersionId.startsWith('artifact-version-'), true);
    assert.equal((await artifactsRepo.listVersions('chat-1', artifact.artifactId)).length, 1);
    assert.deepEqual((await artifactsRepo.getArtifact('chat-1', artifact.artifactId))?.citations, ['source-a']);
    assert.deepEqual((await otherArtifactsRepo.listArtifacts('chat-1')).map((entry) => entry.title), ['Other']);

    await assert.rejects(
      () => artifactsRepo.exportArtifactToDoc('chat-1', artifact.artifactId, { mode: 'update_linked' }),
      /linked document/i,
    );
    assert.equal((await docsRepo.listDocs()).length, 0);
    assert.equal((await artifactsRepo.getArtifact('chat-1', artifact.artifactId))?.linkedDocId, null);
  });
});
