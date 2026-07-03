import type BetterSqlite3 from 'better-sqlite3';
import { canonicalOwnerId } from '../ownership';
import { normalizeOwnerIds, recreateTable, tableHasColumn } from './schema-utils';

const docsDocumentsTableSql = `
  CREATE TABLE IF NOT EXISTS docs_documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_opened_at TEXT NOT NULL,
    starred INTEGER NOT NULL,
    trashed_at TEXT,
    template_id TEXT NOT NULL,
    active_tab_id TEXT NOT NULL,
    layout_mode TEXT NOT NULL,
    zoom REAL NOT NULL,
    page_settings_json TEXT NOT NULL
  );
`;

const docsTabsTableSql = `
  CREATE TABLE IF NOT EXISTS docs_tabs (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    parent_tab_id TEXT,
    title TEXT NOT NULL,
    tab_order INTEGER NOT NULL,
    outline_visible INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_format TEXT NOT NULL,
    text_content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES docs_documents(id) ON DELETE CASCADE
  );
`;

const docsVersionsTableSql = `
  CREATE TABLE IF NOT EXISTS docs_versions (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    tab_id TEXT,
    created_at TEXT NOT NULL,
    label TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    content_format TEXT NOT NULL,
    snapshot_title TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES docs_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tab_id) REFERENCES docs_tabs(id) ON DELETE SET NULL
  );
`;

const docsCitationsTableSql = `
  CREATE TABLE IF NOT EXISTS docs_citations (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    label TEXT NOT NULL,
    details TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES docs_documents(id) ON DELETE CASCADE
  );
`;

const docsMigrationSourcesTableSql = `
  CREATE TABLE IF NOT EXISTS docs_migration_sources (
    owner_id TEXT NOT NULL,
    source_key TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, source_key)
  );
`;

function ensureDocsSchemaMigrations(database: BetterSqlite3.Database) {
  if (!tableHasColumn(database, 'docs_documents', 'owner_id')) {
    recreateTable(database, 'docs_documents', docsDocumentsTableSql, (legacyTableName) => `
      INSERT INTO docs_documents (id, owner_id, title, created_at, updated_at, last_opened_at, starred, trashed_at, template_id, active_tab_id, layout_mode, zoom, page_settings_json)
      SELECT id, '${canonicalOwnerId}', title, created_at, updated_at, last_opened_at, starred, trashed_at, template_id, active_tab_id, layout_mode, zoom, page_settings_json
      FROM "${legacyTableName}"
    `);
  }

  if (!tableHasColumn(database, 'docs_tabs', 'owner_id')) {
    recreateTable(database, 'docs_tabs', docsTabsTableSql, (legacyTableName) => `
      INSERT INTO docs_tabs (id, owner_id, document_id, parent_tab_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      SELECT legacy.id, document.owner_id, legacy.document_id, legacy.parent_tab_id, legacy.title, legacy.tab_order, legacy.outline_visible, legacy.content, legacy.content_format, legacy.text_content, legacy.created_at, legacy.updated_at
      FROM "${legacyTableName}" legacy
      JOIN docs_documents document ON document.id = legacy.document_id
    `);
  }

  if (!tableHasColumn(database, 'docs_versions', 'owner_id')) {
    recreateTable(database, 'docs_versions', docsVersionsTableSql, (legacyTableName) => `
      INSERT INTO docs_versions (id, owner_id, document_id, tab_id, created_at, label, kind, content, content_format, snapshot_title)
      SELECT legacy.id, document.owner_id, legacy.document_id, legacy.tab_id, legacy.created_at, legacy.label, legacy.kind, legacy.content, legacy.content_format, legacy.snapshot_title
      FROM "${legacyTableName}" legacy
      JOIN docs_documents document ON document.id = legacy.document_id
    `);
  }

  if (!tableHasColumn(database, 'docs_citations', 'owner_id')) {
    recreateTable(database, 'docs_citations', docsCitationsTableSql, (legacyTableName) => `
      INSERT INTO docs_citations (id, owner_id, document_id, label, details)
      SELECT legacy.id, document.owner_id, legacy.document_id, legacy.label, legacy.details
      FROM "${legacyTableName}" legacy
      JOIN docs_documents document ON document.id = legacy.document_id
    `);
  }

  if (!tableHasColumn(database, 'docs_migration_sources', 'owner_id')) {
    recreateTable(database, 'docs_migration_sources', docsMigrationSourcesTableSql, (legacyTableName) => `
      INSERT INTO docs_migration_sources (owner_id, source_key, imported_at)
      SELECT '${canonicalOwnerId}', source_key, imported_at
      FROM "${legacyTableName}"
    `);
  }
}

export function ensureDocsSchema(database: BetterSqlite3.Database) {
  ensureDocsSchemaMigrations(database);
  database.exec(`
    ${docsDocumentsTableSql}
    ${docsTabsTableSql}
    ${docsVersionsTableSql}
    ${docsCitationsTableSql}
    ${docsMigrationSourcesTableSql}

    CREATE INDEX IF NOT EXISTS idx_docs_documents_owner_updated_at ON docs_documents(owner_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_tabs_owner_document_id ON docs_tabs(owner_id, document_id, tab_order, id);
    CREATE INDEX IF NOT EXISTS idx_docs_versions_owner_document_created ON docs_versions(owner_id, document_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_citations_owner_document_id ON docs_citations(owner_id, document_id, id);
  `);

  normalizeOwnerIds(database, 'docs_documents');
  normalizeOwnerIds(database, 'docs_tabs');
  normalizeOwnerIds(database, 'docs_versions');
  normalizeOwnerIds(database, 'docs_citations');
  normalizeOwnerIds(database, 'docs_migration_sources');
}
