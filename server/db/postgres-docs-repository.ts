import type { Pool, PoolClient } from 'pg';
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
import { getPostgresPool } from './postgres';
import { createPostgresAppSettingsRepository } from './postgres-app-settings-repository';
import { asBoolean, assertOwnerUuid, normalizeJsonb, runPostgresTransaction, toIsoString, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

const docsPreferencesKey = 'docs.preferences';
const defaultVersionPageSize = 25;

type Row = Record<string, unknown>;

function mapDoc(row: Row): DocRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
    lastOpenedAt: toIsoString(row.last_opened_at),
    starred: asBoolean(row.starred),
    trashedAt: row.trashed_at ? toIsoString(row.trashed_at) : null,
    templateId: String(row.template_id),
    activeTabId: String(row.active_tab_id),
    layoutMode: String(row.layout_mode) as DocRecord['layoutMode'],
    zoom: Number(row.zoom),
    pageSettings: normalizeJsonb(row.page_settings_json) as DocRecord['pageSettings'],
  };
}

function mapTab(row: Row): DocTabRecord {
  return {
    id: String(row.id),
    docId: String(row.document_id),
    parentTabId: row.parent_tab_id ? String(row.parent_tab_id) : null,
    title: String(row.title),
    order: Number(row.tab_order),
    outlineVisible: asBoolean(row.outline_visible),
    content: String(row.content),
    contentFormat: String(row.content_format) as DocTabRecord['contentFormat'],
    textContent: String(row.text_content),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapVersionSummary(row: Row): DocVersionSummary {
  return {
    id: String(row.id),
    docId: String(row.document_id),
    tabId: row.tab_id ? String(row.tab_id) : null,
    createdAt: toIsoString(row.created_at),
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

export function createPostgresDocsRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
) {
  const validatedOwnerId = assertOwnerUuid(ownerId);

  function settingsRepository(nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    return createPostgresAppSettingsRepository(validatedOwnerId, nextExecutor);
  }

  async function saveDocRow(doc: DocRecord, nextExecutor: PostgresExecutor) {
    await nextExecutor.query(`
      INSERT INTO docs_documents (owner_id, id, title, created_at, updated_at, last_opened_at, starred, trashed_at, template_id, active_tab_id, layout_mode, zoom, page_settings_json)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      ON CONFLICT(owner_id, id) DO UPDATE SET
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
    `, [validatedOwnerId, doc.id, doc.title, doc.createdAt, doc.updatedAt, doc.lastOpenedAt, doc.starred, doc.trashedAt, doc.templateId, doc.activeTabId, doc.layoutMode, doc.zoom, toJsonbParam(doc.pageSettings ?? defaultPageSettings)]);
  }

  async function saveTabRow(tab: DocTabRecord, nextExecutor: PostgresExecutor) {
    await nextExecutor.query(`
      INSERT INTO docs_tabs (owner_id, id, document_id, parent_tab_id, title, tab_order, outline_visible, content, content_format, text_content, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT(owner_id, id) DO UPDATE SET
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
    `, [validatedOwnerId, tab.id, tab.docId, tab.parentTabId, tab.title, tab.order, tab.outlineVisible, tab.content, tab.contentFormat, tab.textContent, tab.createdAt, tab.updatedAt]);
  }

  async function saveVersionRow(version: DocVersionDetail, nextExecutor: PostgresExecutor) {
    await nextExecutor.query(`
      INSERT INTO docs_versions (owner_id, id, document_id, tab_id, created_at, label, kind, content, content_format, snapshot_title)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(owner_id, id) DO UPDATE SET
        document_id = excluded.document_id,
        tab_id = excluded.tab_id,
        created_at = excluded.created_at,
        label = excluded.label,
        kind = excluded.kind,
        content = excluded.content,
        content_format = excluded.content_format,
        snapshot_title = excluded.snapshot_title
    `, [validatedOwnerId, version.id, version.docId, version.tabId, version.createdAt, version.label, version.kind, version.content, version.contentFormat, version.snapshotTitle]);
  }

  async function upsertCitationRow(docId: string, citation: CitationSource, nextExecutor: PostgresExecutor) {
    await nextExecutor.query(`
      INSERT INTO docs_citations (owner_id, id, document_id, label, details)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(owner_id, id) DO UPDATE SET
        document_id = excluded.document_id,
        label = excluded.label,
        details = excluded.details
    `, [validatedOwnerId, citation.id, docId, citation.label, citation.details]);
  }

  async function listVersionsWithExecutor(nextExecutor: PostgresExecutor, docId: string, cursor?: string | null, limit = defaultVersionPageSize): Promise<ListDocVersionsResponse> {
    const decoded = cursor ? decodeCursor(cursor) : null;
    const result = decoded
      ? await nextExecutor.query(`
          SELECT * FROM docs_versions
          WHERE owner_id = $1 AND document_id = $2 AND (created_at < $3 OR (created_at = $3 AND id < $4))
          ORDER BY created_at DESC, id DESC
          LIMIT $5
        `, [validatedOwnerId, docId, decoded.createdAt, decoded.id, limit + 1])
      : await nextExecutor.query(`
          SELECT * FROM docs_versions
          WHERE owner_id = $1 AND document_id = $2
          ORDER BY created_at DESC, id DESC
          LIMIT $3
        `, [validatedOwnerId, docId, limit + 1]);
    const versions = result.rows.slice(0, limit).map((row) => mapVersionSummary(row as Row));
    return { versions, nextCursor: result.rows.length > limit ? encodeCursor(versions.at(-1)!) : null };
  }

  async function getDocBundleWithExecutor(nextExecutor: PostgresExecutor, docId: string, cursor?: string | null) {
    const openedAt = new Date().toISOString();
    await nextExecutor.query('UPDATE docs_documents SET last_opened_at = $1 WHERE owner_id = $2 AND id = $3', [openedAt, validatedOwnerId, docId]);
    const docResult = await nextExecutor.query('SELECT * FROM docs_documents WHERE owner_id = $1 AND id = $2', [validatedOwnerId, docId]);
    const docRow = docResult.rows[0] as Row | undefined;
    if (!docRow) return null;
    const tabsResult = await nextExecutor.query('SELECT * FROM docs_tabs WHERE owner_id = $1 AND document_id = $2 ORDER BY tab_order ASC, id ASC', [validatedOwnerId, docId]);
    const citationsResult = await nextExecutor.query('SELECT * FROM docs_citations WHERE owner_id = $1 AND document_id = $2 ORDER BY id ASC', [validatedOwnerId, docId]);
    const versionsPage = await listVersionsWithExecutor(nextExecutor, docId, cursor);
    return {
      doc: mapDoc({ ...docRow, last_opened_at: openedAt }),
      tabs: tabsResult.rows.map((row) => mapTab(row as Row)),
      citations: citationsResult.rows.map((row) => mapCitation(row as Row)),
      versions: versionsPage.versions,
      nextVersionCursor: versionsPage.nextCursor,
    } satisfies DocBundle;
  }

  function buildDoc(title: string, templateId: string, activeTabId: string): DocRecord {
    const now = new Date().toISOString();
    return { id: createDocId('doc'), title, createdAt: now, updatedAt: now, lastOpenedAt: now, starred: false, trashedAt: null, templateId, activeTabId, layoutMode: 'pages', zoom: 100, pageSettings: defaultPageSettings };
  }

  return {
    async countDocs() {
      const result = await (executor as PostgresExecutor).query('SELECT COUNT(*) AS count FROM docs_documents WHERE owner_id = $1', [validatedOwnerId]);
      return Number((result.rows[0] as { count: string | number }).count);
    },
    async listDocs(query?: string, sort?: DocPreferences['sort'], showTrash?: boolean): Promise<DocSearchIndexEntry[]> {
      const result = await (executor as PostgresExecutor).query(`
        SELECT d.*, COALESCE((SELECT text_content FROM docs_tabs WHERE owner_id = d.owner_id AND document_id = d.id ORDER BY tab_order ASC, id ASC LIMIT 1), '') AS preview
        FROM docs_documents d
        WHERE d.owner_id = $1
        ORDER BY d.last_opened_at DESC, d.id DESC
      `, [validatedOwnerId]);
      const normalized = query?.trim().toLowerCase() ?? '';
      const nextSort = sort ?? defaultDocPreferences.sort;
      return result.rows.map((row) => ({
        id: String((row as Row).id),
        title: String((row as Row).title),
        updatedAt: toIsoString((row as Row).updated_at),
        lastOpenedAt: toIsoString((row as Row).last_opened_at),
        starred: asBoolean((row as Row).starred),
        trashedAt: (row as Row).trashed_at ? toIsoString((row as Row).trashed_at) : null,
        preview: String((row as Row).preview),
      }))
        .filter((doc) => showTrash ? Boolean(doc.trashedAt) : !doc.trashedAt)
        .filter((doc) => !normalized || `${doc.title} ${doc.preview}`.toLowerCase().includes(normalized))
        .sort((left, right) => nextSort === 'title' ? left.title.localeCompare(right.title) : right[nextSort].localeCompare(left[nextSort]));
    },
    async createDoc(templateId = 'blank') {
      const template = docTemplates.find((entry) => entry.id === templateId) ?? docTemplates[0];
      const now = new Date().toISOString();
      const tabs = template.tabs.map((tab, index) => ({ id: createDocId('tab'), docId: '', parentTabId: tab.parentTabId, title: tab.title, order: index, outlineVisible: true, content: tab.html, contentFormat: 'html' as const, textContent: stripDocHtml(tab.html), createdAt: now, updatedAt: now }));
      const doc = buildDoc(template.title, template.id, tabs[0].id);
      tabs.forEach((tab) => { tab.docId = doc.id; });
      await runPostgresTransaction(executor, async (client) => {
        await saveDocRow(doc, client);
        for (const tab of tabs) await saveTabRow(tab, client);
      });
      return (await getDocBundleWithExecutor(executor as PostgresExecutor, doc.id))!;
    },
    async createImportedDoc(title: string, html: string) {
      const now = new Date().toISOString();
      const tab: DocTabRecord = { id: createDocId('tab'), docId: '', parentTabId: null, title: 'Imported', order: 0, outlineVisible: true, content: html, contentFormat: 'html', textContent: stripDocHtml(html), createdAt: now, updatedAt: now };
      const doc = buildDoc(title, 'blank', tab.id);
      tab.docId = doc.id;
      const version = createVersion(doc, tab, 'import', 'Imported document');
      await runPostgresTransaction(executor, async (client) => {
        await saveDocRow(doc, client);
        await saveTabRow(tab, client);
        await saveVersionRow(version, client);
      });
      return (await getDocBundleWithExecutor(executor as PostgresExecutor, doc.id))!;
    },
    async ensureSeedDoc() {
      if (await this.countDocs() === 0) {
        return this.createDoc('blank');
      }
      return null;
    },
    async getDocBundle(docId: string, cursor?: string | null) {
      return getDocBundleWithExecutor(executor as PostgresExecutor, docId, cursor);
    },
    async saveDoc(request: SaveDocRequest) {
      await runPostgresTransaction(executor, async (client) => {
        await saveDocRow(request.doc, client);
        if (request.tab) await saveTabRow(request.tab, client);
        if (request.tab && request.version) await saveVersionRow(createVersion(request.doc, request.tab, request.version.kind, request.version.label), client);
      });
      return (await getDocBundleWithExecutor(executor as PostgresExecutor, request.doc.id))!;
    },
    async saveTabs(tabs: DocTabRecord[]) {
      if (!tabs.length) return null;
      await runPostgresTransaction(executor, async (client) => {
        for (const tab of tabs) await saveTabRow(tab, client);
      });
      return (await getDocBundleWithExecutor(executor as PostgresExecutor, tabs[0].docId))!;
    },
    async deleteTab(docId: string, tabId: string) {
      const bundle = await getDocBundleWithExecutor(executor as PostgresExecutor, docId);
      if (!bundle || bundle.tabs.length <= 1) return bundle;
      const remainingTabs = bundle.tabs.filter((tab) => tab.id !== tabId).map((tab, index) => ({ ...tab, order: index }));
      const activeTabId = bundle.doc.activeTabId === tabId ? remainingTabs[0].id : bundle.doc.activeTabId;
      const nextDoc = { ...bundle.doc, activeTabId, updatedAt: new Date().toISOString() };
      await runPostgresTransaction(executor, async (client) => {
        await client.query('DELETE FROM docs_tabs WHERE owner_id = $1 AND document_id = $2 AND id = $3', [validatedOwnerId, docId, tabId]);
        await saveDocRow(nextDoc, client);
        for (const tab of remainingTabs) await saveTabRow(tab, client);
      });
      return (await getDocBundleWithExecutor(executor as PostgresExecutor, docId))!;
    },
    async duplicateDoc(docId: string) {
      const bundle = await getDocBundleWithExecutor(executor as PostgresExecutor, docId);
      if (!bundle) return null;
      const now = new Date().toISOString();
      const tabs = bundle.tabs.map((tab) => ({ ...tab, id: createDocId('tab'), docId: '', createdAt: now, updatedAt: now }));
      const doc = buildDoc(`${bundle.doc.title} Copy`, bundle.doc.templateId, tabs[0].id);
      tabs.forEach((tab) => { tab.docId = doc.id; });
      await runPostgresTransaction(executor, async (client) => {
        await saveDocRow(doc, client);
        for (const tab of tabs) await saveTabRow(tab, client);
      });
      return (await getDocBundleWithExecutor(executor as PostgresExecutor, doc.id))!;
    },
    async setDocField(docId: string, updater: (doc: DocRecord) => DocRecord) {
      const bundle = await getDocBundleWithExecutor(executor as PostgresExecutor, docId);
      if (!bundle) return null;
      await saveDocRow(updater(bundle.doc), executor as PostgresExecutor);
      return getDocBundleWithExecutor(executor as PostgresExecutor, docId);
    },
    async deleteDoc(docId: string) {
      await (executor as PostgresExecutor).query('DELETE FROM docs_documents WHERE owner_id = $1 AND id = $2', [validatedOwnerId, docId]);
    },
    async saveCitations(docId: string, citations: CitationSource[]) {
      await runPostgresTransaction(executor, async (client) => {
        await client.query('DELETE FROM docs_citations WHERE owner_id = $1 AND document_id = $2', [validatedOwnerId, docId]);
        for (const citation of citations) await upsertCitationRow(docId, citation, client);
      });
      return citations;
    },
    async listVersions(docId: string, cursor?: string | null, limit = defaultVersionPageSize) {
      return listVersionsWithExecutor(executor as PostgresExecutor, docId, cursor, limit);
    },
    async getVersion(docId: string, versionId: string) {
      const result = await (executor as PostgresExecutor).query('SELECT * FROM docs_versions WHERE owner_id = $1 AND document_id = $2 AND id = $3', [validatedOwnerId, docId, versionId]);
      const row = result.rows[0] as Row | undefined;
      return row ? mapVersionDetail(row) : null;
    },
    async restoreVersion(docId: string, versionId: string) {
      const bundle = await getDocBundleWithExecutor(executor as PostgresExecutor, docId);
      const version = bundle ? await this.getVersion(docId, versionId) : null;
      if (!bundle || !version) return null;
      const targetTab = bundle.tabs.find((tab) => tab.id === version.tabId) ?? bundle.tabs[0];
      const updatedAt = new Date().toISOString();
      const nextTab = { ...targetTab, content: version.content, contentFormat: version.contentFormat, textContent: stripDocHtml(version.content), updatedAt };
      const nextDoc = { ...bundle.doc, activeTabId: nextTab.id, updatedAt, lastOpenedAt: updatedAt };
      return this.saveDoc({ doc: nextDoc, tab: nextTab, version: { kind: 'restore', label: `Restored - ${version.label}` } });
    },
    async loadPreferences() {
      return { ...defaultDocPreferences, ...await settingsRepository().readJsonSetting(docsPreferencesKey, parseDocPreferences, defaultDocPreferences) };
    },
    async savePreferences(preferences: DocPreferences) {
      await settingsRepository().writeJsonSetting(docsPreferencesKey, preferences);
      return this.loadPreferences();
    },
    async hasMigration(sourceKey: string) {
      const result = await (executor as PostgresExecutor).query('SELECT source_key FROM docs_migration_sources WHERE owner_id = $1 AND source_key = $2', [validatedOwnerId, sourceKey]);
      return Boolean(result.rows[0]);
    },
    async importMigration(payload: DocsMigrationImportRequest) {
      const docIds = new Set(payload.docs.map((doc) => doc.id));
      const tabIds = new Set(payload.tabs.map((tab) => tab.id));
      if (payload.tabs.some((tab) => !docIds.has(tab.docId)) || payload.versions.some((version) => !docIds.has(version.docId) || (version.tabId && !tabIds.has(version.tabId))) || payload.citations.some((citation) => !docIds.has(citation.docId))) {
        throw new Error('Migration payload contains invalid document relationships.');
      }

      await runPostgresTransaction(executor, async (client) => {
        for (const doc of payload.docs) await saveDocRow(doc, client);
        for (const tab of payload.tabs) await saveTabRow(tab, client);
        for (const version of payload.versions) await saveVersionRow(version, client);
        for (const citation of payload.citations) await upsertCitationRow(citation.docId, citation, client);
        if (payload.preferences) await settingsRepository(client).writeJsonSetting(docsPreferencesKey, payload.preferences);
        await client.query(`
          INSERT INTO docs_migration_sources (owner_id, source_key, imported_at)
          VALUES ($1, $2, $3)
          ON CONFLICT(owner_id, source_key) DO UPDATE SET imported_at = excluded.imported_at
        `, [validatedOwnerId, payload.sourceKey, new Date().toISOString()]);
      });

      return {
        docs: payload.docs.length,
        tabs: payload.tabs.length,
        versions: payload.versions.length,
        citations: payload.citations.length,
      };
    },
  };
}
