import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { assertSafePostgresTestDatabase } from './postgres-config';

const migrationUrl = new URL('../../supabase/migrations/20260704000000_owner_workspace_tables.sql', import.meta.url);
const migrationSql = await readFile(migrationUrl, 'utf8');
const connectionString = process.env.POSTGRES_TEST_DATABASE_URL
  ?? 'postgresql://thebestappeva:thebestappeva_test@127.0.0.1:54323/thebestappeva_test';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

const ownerTables = [
  'app_settings',
  'ai_chats',
  'ai_artifacts',
  'ai_artifact_versions',
  'docs_documents',
  'docs_tabs',
  'docs_versions',
  'docs_citations',
  'docs_migration_sources',
  'skills',
  'automations',
  'workspace_revision_state',
] as const;

const expectedIndexes = [
  'idx_ai_chats_owner_updated',
  'idx_ai_artifacts_owner_chat_updated',
  'idx_ai_artifact_versions_owner_artifact_created',
  'idx_docs_documents_owner_updated_at',
  'idx_docs_documents_owner_last_opened_at',
  'idx_docs_tabs_owner_document_id',
  'idx_docs_versions_owner_document_created',
  'idx_docs_citations_owner_document_id',
  'idx_skills_owner_name',
  'idx_skills_owner_enabled',
  'idx_skills_owner_updated_at',
  'idx_automations_owner_name',
  'idx_automations_owner_enabled',
  'idx_automations_owner_due',
  'idx_automations_owner_updated_at',
  'idx_workspace_revision_state_owner_updated',
] as const;

async function probePostgres() {
  try {
    assertSafePostgresTestDatabase(connectionString, 'POSTGRES_TEST_DATABASE_URL');
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 1000, max: 1 });
    await pool.query('SELECT 1');
    await pool.end();
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `local test Postgres unavailable: ${message}`;
  }
}

const skipReason = await probePostgres();

function migrationTest(name: string, fn: () => Promise<void>) {
  return skipReason ? test(name, { skip: skipReason }, fn) : test(name, fn);
}

async function withClient<T>(run: (client: PoolClient) => Promise<T>) {
  const pool = new Pool({ connectionString, max: 1 });
  const client = await pool.connect();
  try {
    return await run(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function resetDatabase(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS
      workspace_revision_state,
      automations,
      skills,
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
  await client.query(migrationSql);
}

async function applyFreshMigration(client: PoolClient) {
  await resetDatabase(client);
  await applyMigration(client);
}

async function expectRejected(client: PoolClient, sql: string, values: unknown[] = []) {
  await assert.rejects(() => client.query(sql, values));
}

migrationTest('applies owner workspace migration to an empty database', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const tables = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name
    `, [ownerTables]);

    assert.deepEqual(tables.rows.map((row) => row.table_name), [...ownerTables].sort());
  });
});

migrationTest('safely reapplies the owner workspace migration', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);
    await applyMigration(client);

    const policies = await client.query<{ count: string }>(`
      SELECT COUNT(*) AS count
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
    `, [ownerTables]);

    assert.equal(Number(policies.rows[0].count), ownerTables.length);
  });
});

migrationTest('enforces migrated foreign-key cascade and nullification behavior', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    await client.query(`
      INSERT INTO ai_artifacts (owner_id, id, chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, created_at, updated_at)
      VALUES ($1, 'artifact-1', 'chat-1', 'Artifact', 'markdown', 1, 'Body', '{}', '[]', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO ai_artifact_versions (owner_id, id, artifact_id, title, type, content_markdown, context_policy_json, citations_json, actor, reason, created_at)
      VALUES ($1, 'artifact-version-1', 'artifact-1', 'Artifact', 'markdown', 'Body', '{}', '[]', 'assistant', 'snapshot', now())
    `, [ownerA]);
    await client.query('DELETE FROM ai_artifacts WHERE owner_id = $1 AND id = $2', [ownerA, 'artifact-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM ai_artifact_versions')).rows[0].count), 0);

    await client.query(`
      INSERT INTO docs_documents (owner_id, id, title, created_at, updated_at, last_opened_at, starred, template_id, active_tab_id, layout_mode, zoom, page_settings_json)
      VALUES ($1, 'doc-1', 'Doc', now(), now(), now(), false, 'blank', 'tab-1', 'pages', 100, '{}')
    `, [ownerA]);
    await client.query(`
      INSERT INTO docs_tabs (owner_id, id, document_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, 'tab-1', 'doc-1', 'Tab', 0, true, '<p>Body</p>', 'html', 'Body', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO docs_versions (owner_id, id, document_id, tab_id, created_at, label, kind, content, content_format, snapshot_title)
      VALUES ($1, 'version-1', 'doc-1', 'tab-1', now(), 'Autosave', 'auto', '<p>Body</p>', 'html', 'Doc')
    `, [ownerA]);
    await client.query('DELETE FROM docs_tabs WHERE owner_id = $1 AND id = $2', [ownerA, 'tab-1']);
    assert.equal((await client.query('SELECT tab_id FROM docs_versions WHERE owner_id = $1 AND id = $2', [ownerA, 'version-1'])).rows[0].tab_id, null);

    await client.query(`
      INSERT INTO docs_tabs (owner_id, id, document_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, 'tab-2', 'doc-1', 'Tab 2', 0, true, '<p>Body</p>', 'html', 'Body', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO docs_citations (owner_id, id, document_id, label, details)
      VALUES ($1, 'citation-1', 'doc-1', 'Source', 'Details')
    `, [ownerA]);
    await client.query('DELETE FROM docs_documents WHERE owner_id = $1 AND id = $2', [ownerA, 'doc-1']);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM docs_versions')).rows[0].count), 0);
    assert.equal(Number((await client.query('SELECT COUNT(*) AS count FROM docs_citations')).rows[0].count), 0);

    await expectRejected(client, `
      INSERT INTO docs_tabs (owner_id, id, document_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, 'tab-bad', 'missing-doc', 'Bad', 0, true, '', 'html', '', now(), now())
    `, [ownerA]);
  });
});

migrationTest('enforces owner-scoped unique constraints', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    await client.query(`
      INSERT INTO skills (owner_id, id, name, description, instructions, created_at, updated_at)
      VALUES ($1, 'skill-1', 'writer', 'Mine', 'Write', now(), now())
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO skills (owner_id, id, name, description, instructions, created_at, updated_at)
      VALUES ($1, 'skill-2', 'writer', 'Duplicate', 'Write', now(), now())
    `, [ownerA]);
    await client.query(`
      INSERT INTO skills (owner_id, id, name, description, instructions, created_at, updated_at)
      VALUES ($1, 'skill-2', 'writer', 'Other owner', 'Write', now(), now())
    `, [ownerB]);

    await client.query(`
      INSERT INTO app_settings (owner_id, key, value_json)
      VALUES ($1, 'docs.preferences', '{"sort":"updatedAt"}')
    `, [ownerA]);
    await expectRejected(client, `
      INSERT INTO app_settings (owner_id, key, value_json)
      VALUES ($1, 'docs.preferences', '{}')
    `, [ownerA]);
  });
});

migrationTest('uses JSONB for serialized application data columns', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const jsonColumns = await client.query<{ table_name: string; column_name: string; data_type: string }>(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (
          ('app_settings', 'value_json'),
          ('ai_chats', 'payload_json'),
          ('ai_artifacts', 'context_policy_json'),
          ('ai_artifacts', 'citations_json'),
          ('ai_artifact_versions', 'context_policy_json'),
          ('ai_artifact_versions', 'citations_json'),
          ('docs_documents', 'page_settings_json'),
          ('skills', 'compatible_modes_json'),
          ('skills', 'metadata_json'),
          ('automations', 'trigger_json'),
          ('automations', 'action_json'),
          ('workspace_revision_state', 'state_json')
        )
    `);

    assert.equal(jsonColumns.rows.length, 12);
    assert.equal(jsonColumns.rows.every((row) => row.data_type === 'jsonb'), true);

    await client.query('INSERT INTO app_settings (owner_id, key, value_json) VALUES ($1, $2, $3)', [ownerA, 'ai.enabled-tools', { webSearch: true }]);
    const row = await client.query("SELECT value_json->>'webSearch' AS enabled FROM app_settings WHERE owner_id = $1", [ownerA]);
    assert.equal(row.rows[0].enabled, 'true');
  });
});

migrationTest('creates owner-prefixed indexes for repository access patterns', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const indexes = await client.query<{ indexname: string; indexdef: string }>(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ANY($1::text[])
      ORDER BY indexname
    `, [expectedIndexes]);

    assert.deepEqual(indexes.rows.map((row) => row.indexname), [...expectedIndexes].sort());
    for (const row of indexes.rows) {
      assert.match(row.indexdef, /owner_id/);
    }
    assert.match(indexes.rows.find((row) => row.indexname === 'idx_docs_versions_owner_document_created')?.indexdef ?? '', /created_at DESC, id DESC/);
    assert.match(indexes.rows.find((row) => row.indexname === 'idx_docs_tabs_owner_document_id')?.indexdef ?? '', /tab_order, id/);
  });
});

migrationTest('enables RLS with authenticated owner policies and denies anonymous table access', async () => {
  await withClient(async (client) => {
    await applyFreshMigration(client);

    const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relnamespace = 'public'::regnamespace
        AND relname = ANY($1::text[])
    `, [ownerTables]);

    assert.equal(rls.rows.length, ownerTables.length);
    assert.equal(rls.rows.every((row) => row.relrowsecurity), true);

    const policies = await client.query<{ tablename: string; roles: string; qual: string; with_check: string }>(`
      SELECT tablename, array_to_string(roles, ',') AS roles, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY($1::text[])
      ORDER BY tablename
    `, [ownerTables]);

    assert.equal(policies.rows.length, ownerTables.length);
    for (const policy of policies.rows) {
      assert.equal(policy.roles, 'authenticated');
      assert.equal(policy.qual, '(owner_id = auth.uid())');
      assert.equal(policy.with_check, '(owner_id = auth.uid())');
    }

    await client.query('INSERT INTO app_settings (owner_id, key, value_json) VALUES ($1, $2, $3)', [ownerA, 'private', { ok: true }]);
    await client.query('INSERT INTO app_settings (owner_id, key, value_json) VALUES ($1, $2, $3)', [ownerB, 'private', { ok: false }]);

    await client.query('BEGIN');
    try {
      await client.query('SELECT set_config($1, $2, true)', ['request.jwt.claim.sub', ownerA]);
      await client.query('SET LOCAL ROLE authenticated');
      const visible = await client.query('SELECT owner_id, key FROM app_settings ORDER BY owner_id');
      assert.deepEqual(visible.rows, [{ owner_id: ownerA, key: 'private' }]);
    } finally {
      await client.query('ROLLBACK');
    }

    await client.query('BEGIN');
    try {
      await client.query('SET LOCAL ROLE anon');
      await expectRejected(client, 'SELECT * FROM app_settings');
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
