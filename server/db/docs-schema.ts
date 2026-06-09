import type BetterSqlite3 from 'better-sqlite3';

export function ensureDocsSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS docs_documents (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS docs_tabs (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS docs_versions (
      id TEXT PRIMARY KEY,
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

    CREATE TABLE IF NOT EXISTS docs_citations (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      label TEXT NOT NULL,
      details TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES docs_documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS docs_migration_sources (
      source_key TEXT PRIMARY KEY,
      imported_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_docs_documents_updated_at ON docs_documents(updated_at);
    CREATE INDEX IF NOT EXISTS idx_docs_tabs_document_id ON docs_tabs(document_id);
    CREATE INDEX IF NOT EXISTS idx_docs_versions_document_created ON docs_versions(document_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_citations_document_id ON docs_citations(document_id);
  `);
}
