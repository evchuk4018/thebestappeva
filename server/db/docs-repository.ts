import type BetterSqlite3 from 'better-sqlite3';
import { defaultDocPreferences, defaultPageSettings, docTemplates } from '../../shared/docs-defaults';
import { createDocId, createTimestampLabel, stripDocHtml } from '../../shared/docs-helpers';
import type {
  CitationSource,
  DocBundle,
  DocPreferences,
  DocRecord,
  DocSearchIndexEntry,
  DocTabRecord,
  DocVersionDetail,
  DocVersionKind,
  DocVersionSummary,
  DocsMigrationImportRequest,
  ListDocVersionsResponse,
  SaveDocRequest,
} from '../../shared/docs-contract';
import { parseDocPreferences } from '../../shared/docs-contract';
import { getCanonicalOwnerId } from '../ownership';
import { getDatabase } from './database';
import { createAppSettingsRepository } from './app-settings-repository';

const docsPreferencesKey = 'docs.preferences';
const defaultVersionPageSize = 25;

type Row = Record<string, string | number | null>;

function mapDoc(row: Row): DocRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastOpenedAt: String(row.last_opened_at),
    starred: Boolean(row.starred),
    trashedAt: row.trashed_at ? String(row.trashed_at) : null,
    templateId: String(row.template_id),
    activeTabId: String(row.active_tab_id),
    layoutMode: String(row.layout_mode) as DocRecord['layoutMode'],
    zoom: Number(row.zoom),
    pageSettings: JSON.parse(String(row.page_settings_json)),
  };
}

function mapTab(row: Row): DocTabRecord {
  return {
    id: String(row.id),
    docId: String(row.document_id),
    parentTabId: row.parent_tab_id ? String(row.parent_tab_id) : null,
    title: String(row.title),
    order: Number(row.tab_order),
    outlineVisible: Boolean(row.outline_visible),
    content: String(row.content),
    contentFormat: String(row.content_format) as DocTabRecord['contentFormat'],
    textContent: String(row.text_content),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapVersionSummary(row: Row): DocVersionSummary {
  return {
    id: String(row.id),
    docId: String(row.document_id),
    tabId: row.tab_id ? String(row.tab_id) : null,
    createdAt: String(row.created_at),
    label: String(row.label),
    kind: String(row.kind) as DocVersionKind,
    snapshotTitle: String(row.snapshot_title),
  };
}

function mapVersionDetail(row: Row): DocVersionDetail {
  return { ...mapVersionSummary(row), content: String(row.content), contentFormat: String(row.content_format) as DocVersionDetail['contentFormat'] };
}

function mapCitation(row: Row): CitationSource {
  return { id: String(row.id), label: String(row.label), details: String(row.details) };
}

function encodeCursor(version: DocVersionSummary) {
  return `${version.createdAt}::${version.id}`;
}

function decodeCursor(cursor: string) {
  const [createdAt, id] = cursor.split('::');
  return { createdAt, id };
}

function createVersion(doc: DocRecord, tab: DocTabRecord, kind: DocVersionKind, label?: string | null): DocVersionDetail {
  const createdAt = doc.updatedAt || new Date().toISOString();
  return {
    id: createDocId('version'),
    docId: doc.id,
    tabId: tab.id,
    createdAt,
    label: label?.trim() || `${kind === 'named' ? 'Named version' : kind === 'restore' ? 'Restored' : kind === 'import' ? 'Imported' : 'Autosave'} - ${createTimestampLabel()}`,
    kind,
    content: tab.content,
    contentFormat: tab.contentFormat,
    snapshotTitle: doc.title,
  };
}

export function createDocsRepository(
  database: BetterSqlite3.Database = getDatabase(),
  ownerId = getCanonicalOwnerId(),
) {
  const settingsRepository = createAppSettingsRepository(database, ownerId);
  const upsertDoc = database.prepare(`
    INSERT INTO docs_documents (id, owner_id, title, created_at, updated_at, last_opened_at, starred, trashed_at, template_id, active_tab_id, layout_mode, zoom, page_settings_json)
    VALUES (@id, @owner_id, @title, @created_at, @updated_at, @last_opened_at, @starred, @trashed_at, @template_id, @active_tab_id, @layout_mode, @zoom, @page_settings_json)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      title = excluded.title,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_opened_at = excluded.last_opened_at,
      starred = excluded.starred,
      trashed_at = excluded.trashed_at,
      template_id = excluded.template_id,
      active_tab_id = excluded.active_tab_id,
      layout_mode = excluded.layout_mode,
      zoom = excluded.zoom,
      page_settings_json = excluded.page_settings_json
  `);
  const upsertTab = database.prepare(`
    INSERT INTO docs_tabs (id, owner_id, document_id, parent_tab_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
    VALUES (@id, @owner_id, @document_id, @parent_tab_id, @title, @tab_order, @outline_visible, @content, @content_format, @text_content, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      document_id = excluded.document_id,
      parent_tab_id = excluded.parent_tab_id,
      title = excluded.title,
      tab_order = excluded.tab_order,
      outline_visible = excluded.outline_visible,
      content = excluded.content,
      content_format = excluded.content_format,
      text_content = excluded.text_content,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `);
  const upsertVersion = database.prepare(`
    INSERT INTO docs_versions (id, owner_id, document_id, tab_id, created_at, label, kind, content, content_format, snapshot_title)
    VALUES (@id, @owner_id, @document_id, @tab_id, @created_at, @label, @kind, @content, @content_format, @snapshot_title)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      document_id = excluded.document_id,
      tab_id = excluded.tab_id,
      created_at = excluded.created_at,
      label = excluded.label,
      kind = excluded.kind,
      content = excluded.content,
      content_format = excluded.content_format,
      snapshot_title = excluded.snapshot_title
  `);
  const upsertCitation = database.prepare(`
    INSERT INTO docs_citations (id, owner_id, document_id, label, details)
    VALUES (@id, @owner_id, @document_id, @label, @details)
    ON CONFLICT(id) DO UPDATE SET
      owner_id = excluded.owner_id,
      document_id = excluded.document_id,
      label = excluded.label,
      details = excluded.details
  `);

  function saveDocRow(doc: DocRecord) {
    upsertDoc.run({
      id: doc.id,
      owner_id: ownerId,
      title: doc.title,
      created_at: doc.createdAt,
      updated_at: doc.updatedAt,
      last_opened_at: doc.lastOpenedAt,
      starred: doc.starred ? 1 : 0,
      trashed_at: doc.trashedAt,
      template_id: doc.templateId,
      active_tab_id: doc.activeTabId,
      layout_mode: doc.layoutMode,
      zoom: doc.zoom,
      page_settings_json: JSON.stringify(doc.pageSettings ?? defaultPageSettings),
    });
  }

  function saveTabRow(tab: DocTabRecord) {
    upsertTab.run({
      id: tab.id,
      owner_id: ownerId,
      document_id: tab.docId,
      parent_tab_id: tab.parentTabId,
      title: tab.title,
      tab_order: tab.order,
      outline_visible: tab.outlineVisible ? 1 : 0,
      content: tab.content,
      content_format: tab.contentFormat,
      text_content: tab.textContent,
      created_at: tab.createdAt,
      updated_at: tab.updatedAt,
    });
  }

  function saveVersionRow(version: DocVersionDetail) {
    upsertVersion.run({
      id: version.id,
      owner_id: ownerId,
      document_id: version.docId,
      tab_id: version.tabId,
      created_at: version.createdAt,
      label: version.label,
      kind: version.kind,
      content: version.content,
      content_format: version.contentFormat,
      snapshot_title: version.snapshotTitle,
    });
  }

  function listVersions(docId: string, cursor?: string | null, limit = defaultVersionPageSize): ListDocVersionsResponse {
    const query = cursor
      ? `SELECT * FROM docs_versions WHERE owner_id = ? AND document_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?`
      : `SELECT * FROM docs_versions WHERE owner_id = ? AND document_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`;
    const params = cursor
      ? [ownerId, docId, decodeCursor(cursor).createdAt, decodeCursor(cursor).createdAt, decodeCursor(cursor).id, limit + 1]
      : [ownerId, docId, limit + 1];
    const rows = database.prepare(query).all(...params) as Row[];
    const versions = rows.slice(0, limit).map(mapVersionSummary);
    return { versions, nextCursor: rows.length > limit ? encodeCursor(versions.at(-1)!) : null };
  }

  function getDocBundle(docId: string, cursor?: string | null) {
    const openedAt = new Date().toISOString();
    database.prepare('UPDATE docs_documents SET last_opened_at = ? WHERE owner_id = ? AND id = ?').run(openedAt, ownerId, docId);
    const docRow = database.prepare('SELECT * FROM docs_documents WHERE owner_id = ? AND id = ?').get(ownerId, docId) as Row | undefined;
    if (!docRow) return null;
    const tabs = (database.prepare('SELECT * FROM docs_tabs WHERE owner_id = ? AND document_id = ? ORDER BY tab_order ASC, id ASC').all(ownerId, docId) as Row[]).map(mapTab);
    const citations = (database.prepare('SELECT * FROM docs_citations WHERE owner_id = ? AND document_id = ? ORDER BY id ASC').all(ownerId, docId) as Row[]).map(mapCitation);
    const versionsPage = listVersions(docId, cursor);
    return {
      doc: mapDoc({ ...docRow, last_opened_at: openedAt }),
      tabs,
      citations,
      versions: versionsPage.versions,
      nextVersionCursor: versionsPage.nextCursor,
    } satisfies DocBundle;
  }

  function buildDoc(title: string, templateId: string, activeTabId: string): DocRecord {
    const now = new Date().toISOString();
    return { id: createDocId('doc'), title, createdAt: now, updatedAt: now, lastOpenedAt: now, starred: false, trashedAt: null, templateId, activeTabId, layoutMode: 'pages', zoom: 100, pageSettings: defaultPageSettings };
  }

  return {
    countDocs() {
      return Number((database.prepare('SELECT COUNT(*) AS count FROM docs_documents WHERE owner_id = ?').get(ownerId) as { count: number }).count);
    },
    listDocs(query?: string, sort?: DocPreferences['sort'], showTrash?: boolean): DocSearchIndexEntry[] {
      const rows = database.prepare(`
        SELECT d.*, COALESCE((SELECT text_content FROM docs_tabs WHERE owner_id = d.owner_id AND document_id = d.id ORDER BY tab_order ASC, id ASC LIMIT 1), '') AS preview
        FROM docs_documents d
        WHERE d.owner_id = ?
        ORDER BY d.last_opened_at DESC, d.id DESC
      `).all(ownerId) as Array<Row & { preview: string }>;
      const normalized = query?.trim().toLowerCase() ?? '';
      const nextSort = sort ?? defaultDocPreferences.sort;
      return rows.map((row) => ({ id: String(row.id), title: String(row.title), updatedAt: String(row.updated_at), lastOpenedAt: String(row.last_opened_at), starred: Boolean(row.starred), trashedAt: row.trashed_at ? String(row.trashed_at) : null, preview: String(row.preview) }))
        .filter((doc) => showTrash ? Boolean(doc.trashedAt) : !doc.trashedAt)
        .filter((doc) => !normalized || `${doc.title} ${doc.preview}`.toLowerCase().includes(normalized))
        .sort((left, right) => nextSort === 'title' ? left.title.localeCompare(right.title) : right[nextSort].localeCompare(left[nextSort]));
    },
    createDoc(templateId = 'blank') {
      const template = docTemplates.find((entry) => entry.id === templateId) ?? docTemplates[0];
      const now = new Date().toISOString();
      const tabs = template.tabs.map((tab, index) => ({ id: createDocId('tab'), docId: '', parentTabId: tab.parentTabId, title: tab.title, order: index, outlineVisible: true, content: tab.html, contentFormat: 'html' as const, textContent: stripDocHtml(tab.html), createdAt: now, updatedAt: now }));
      const doc = buildDoc(template.title, template.id, tabs[0].id);
      tabs.forEach((tab) => { tab.docId = doc.id; });
      database.transaction(() => { saveDocRow(doc); tabs.forEach(saveTabRow); })();
      return getDocBundle(doc.id)!;
    },
    createImportedDoc(title: string, html: string) {
      const now = new Date().toISOString();
      const tab: DocTabRecord = { id: createDocId('tab'), docId: '', parentTabId: null, title: 'Imported', order: 0, outlineVisible: true, content: html, contentFormat: 'html', textContent: stripDocHtml(html), createdAt: now, updatedAt: now };
      const doc = buildDoc(title, 'blank', tab.id);
      tab.docId = doc.id;
      const version = createVersion(doc, tab, 'import', 'Imported document');
      database.transaction(() => { saveDocRow(doc); saveTabRow(tab); saveVersionRow(version); })();
      return getDocBundle(doc.id)!;
    },
    ensureSeedDoc() {
      if (this.countDocs() === 0) {
        return this.createDoc('blank');
      }
      return null;
    },
    getDocBundle,
    saveDoc(request: SaveDocRequest) {
      database.transaction(() => {
        saveDocRow(request.doc);
        if (request.tab) saveTabRow(request.tab);
        if (request.tab && request.version) saveVersionRow(createVersion(request.doc, request.tab, request.version.kind, request.version.label));
      })();
      return getDocBundle(request.doc.id)!;
    },
    saveTabs(tabs: DocTabRecord[]) {
      if (!tabs.length) return null;
      database.transaction(() => { tabs.forEach(saveTabRow); })();
      return getDocBundle(tabs[0].docId)!;
    },
    deleteTab(docId: string, tabId: string) {
      const bundle = getDocBundle(docId);
      if (!bundle || bundle.tabs.length <= 1) return bundle;
      const remainingTabs = bundle.tabs.filter((tab) => tab.id !== tabId).map((tab, index) => ({ ...tab, order: index }));
      const activeTabId = bundle.doc.activeTabId === tabId ? remainingTabs[0].id : bundle.doc.activeTabId;
      const nextDoc = { ...bundle.doc, activeTabId, updatedAt: new Date().toISOString() };
      database.transaction(() => {
        database.prepare('DELETE FROM docs_tabs WHERE owner_id = ? AND document_id = ? AND id = ?').run(ownerId, docId, tabId);
        saveDocRow(nextDoc);
        remainingTabs.forEach(saveTabRow);
      })();
      return getDocBundle(docId)!;
    },
    duplicateDoc(docId: string) {
      const bundle = getDocBundle(docId);
      if (!bundle) return null;
      const now = new Date().toISOString();
      const tabs = bundle.tabs.map((tab) => ({ ...tab, id: createDocId('tab'), docId: '', createdAt: now, updatedAt: now }));
      const doc = buildDoc(`${bundle.doc.title} Copy`, bundle.doc.templateId, tabs[0].id);
      tabs.forEach((tab) => { tab.docId = doc.id; });
      database.transaction(() => { saveDocRow(doc); tabs.forEach(saveTabRow); })();
      return getDocBundle(doc.id)!;
    },
    setDocField(docId: string, updater: (doc: DocRecord) => DocRecord) {
      const bundle = getDocBundle(docId);
      if (!bundle) return null;
      saveDocRow(updater(bundle.doc));
      return getDocBundle(docId)!;
    },
    deleteDoc(docId: string) {
      database.prepare('DELETE FROM docs_documents WHERE owner_id = ? AND id = ?').run(ownerId, docId);
    },
    saveCitations(docId: string, citations: CitationSource[]) {
      database.transaction(() => {
        database.prepare('DELETE FROM docs_citations WHERE owner_id = ? AND document_id = ?').run(ownerId, docId);
        citations.forEach((citation) => upsertCitation.run({ id: citation.id, owner_id: ownerId, document_id: docId, label: citation.label, details: citation.details }));
      })();
      return citations;
    },
    listVersions,
    getVersion(docId: string, versionId: string) {
      const row = database.prepare('SELECT * FROM docs_versions WHERE owner_id = ? AND document_id = ? AND id = ?').get(ownerId, docId, versionId) as Row | undefined;
      if (!row) return null;
      return mapVersionDetail(row);
    },
    restoreVersion(docId: string, versionId: string) {
      const bundle = getDocBundle(docId);
      const version = bundle ? this.getVersion(docId, versionId) : null;
      if (!bundle || !version) return null;
      const targetTab = bundle.tabs.find((tab) => tab.id === version.tabId) ?? bundle.tabs[0];
      const updatedAt = new Date().toISOString();
      const nextTab = { ...targetTab, content: version.content, contentFormat: version.contentFormat, textContent: stripDocHtml(version.content), updatedAt };
      const nextDoc = { ...bundle.doc, activeTabId: nextTab.id, updatedAt, lastOpenedAt: updatedAt };
      return this.saveDoc({ doc: nextDoc, tab: nextTab, version: { kind: 'restore', label: `Restored - ${version.label}` } });
    },
    loadPreferences() {
      return { ...defaultDocPreferences, ...settingsRepository.readJsonSetting(docsPreferencesKey, parseDocPreferences, defaultDocPreferences) };
    },
    savePreferences(preferences: DocPreferences) {
      settingsRepository.writeJsonSetting(docsPreferencesKey, preferences);
      return this.loadPreferences();
    },
    hasMigration(sourceKey: string) {
      return Boolean(database.prepare('SELECT source_key FROM docs_migration_sources WHERE owner_id = ? AND source_key = ?').get(ownerId, sourceKey));
    },
    importMigration(payload: DocsMigrationImportRequest) {
      const docIds = new Set(payload.docs.map((doc) => doc.id));
      const tabIds = new Set(payload.tabs.map((tab) => tab.id));
      if (payload.tabs.some((tab) => !docIds.has(tab.docId)) || payload.versions.some((version) => !docIds.has(version.docId) || (version.tabId && !tabIds.has(version.tabId))) || payload.citations.some((citation) => !docIds.has(citation.docId))) {
        throw new Error('Migration payload contains invalid document relationships.');
      }

      database.transaction(() => {
        payload.docs.forEach(saveDocRow);
        payload.tabs.forEach(saveTabRow);
        payload.versions.forEach(saveVersionRow);
        payload.citations.forEach((citation) => upsertCitation.run({ id: citation.id, owner_id: ownerId, document_id: citation.docId, label: citation.label, details: citation.details }));
        if (payload.preferences) settingsRepository.writeJsonSetting(docsPreferencesKey, payload.preferences);
        database.prepare(`
          INSERT INTO docs_migration_sources (owner_id, source_key, imported_at)
          VALUES (?, ?, ?)
          ON CONFLICT(owner_id, source_key) DO UPDATE SET imported_at = excluded.imported_at
        `).run(ownerId, payload.sourceKey, new Date().toISOString());
      })();

      return {
        docs: payload.docs.length,
        tabs: payload.tabs.length,
        versions: payload.versions.length,
        citations: payload.citations.length,
      };
    },
  };
}

let docsRepositorySingleton: ReturnType<typeof createDocsRepository> | null = null;

function getDocsRepositorySingleton() {
  docsRepositorySingleton ??= createDocsRepository();
  return docsRepositorySingleton;
}

export const docsRepository = new Proxy({} as ReturnType<typeof createDocsRepository>, {
  get(_target, property, receiver) {
    return Reflect.get(getDocsRepositorySingleton(), property, receiver);
  },
});
