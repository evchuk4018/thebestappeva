import { defaultDocPreferences } from './docs-data';
import {
  createDoc as createDocRequest,
  createImportedDoc as createImportedDocRequest,
  deleteDoc as deleteDocRequest,
  duplicateDoc as duplicateDocRequest,
  fetchDocBundle,
  fetchDocs,
  getDocVersion,
  loadDocPreferences,
  loadMoreDocVersions,
  restoreDoc,
  restoreDocVersion,
  saveDoc as saveDocRequest,
  saveDocCitations,
  saveDocPreferences,
  saveTabs as saveTabsRequest,
  trashDoc,
} from './docs-api';
import { ensureDocsMigration } from './docs-migration';
import type { CitationSource, DocPreferences, DocTabRecord, DocsRepository, SaveDocRequest } from './docs-types';

async function withMigration<T>(work: () => Promise<T>) {
  await ensureDocsMigration();
  return work();
}

async function getExistingBundle(docId: string) {
  return withMigration(() => fetchDocBundle(docId));
}

export const docsRepository: DocsRepository = {
  listDocs() {
    return withMigration(fetchDocs);
  },
  createDoc(templateId = 'blank') {
    return withMigration(() => createDocRequest({ templateId }));
  },
  createImportedDoc(title: string, html: string) {
    return withMigration(() => createImportedDocRequest({ title, html }));
  },
  getDocBundle(docId: string, cursor?: string | null) {
    return withMigration(() => fetchDocBundle(docId, cursor));
  },
  saveDoc(request: SaveDocRequest, options) {
    return withMigration(() => saveDocRequest(request, options));
  },
  async saveTab(tab: DocTabRecord) {
    return withMigration(async () => {
      const bundle = await saveTabsRequest(tab.docId, [tab]);
      if (!bundle) throw new Error(`Document "${tab.docId}" was not found.`);
      return bundle;
    });
  },
  saveTabs(tabs: DocTabRecord[]) {
    return withMigration(() => tabs.length ? saveTabsRequest(tabs[0].docId, tabs) : Promise.resolve(null));
  },
  loadMoreVersions(docId: string, cursor: string) {
    return withMigration(() => loadMoreDocVersions(docId, cursor));
  },
  getVersion(docId: string, versionId: string) {
    return withMigration(() => getDocVersion(docId, versionId));
  },
  createVersion(_docId: string, request: SaveDocRequest) {
    return withMigration(() => saveDocRequest(request));
  },
  restoreVersion(docId: string, versionId: string) {
    return withMigration(() => restoreDocVersion(docId, versionId));
  },
  duplicateDoc(docId: string) {
    return withMigration(() => duplicateDocRequest(docId));
  },
  async renameDoc(docId: string, title: string) {
    const bundle = await getExistingBundle(docId);
    return bundle ? saveDocRequest({ doc: { ...bundle.doc, title, updatedAt: new Date().toISOString() } }) : null;
  },
  async toggleStar(docId: string) {
    const bundle = await getExistingBundle(docId);
    return bundle ? saveDocRequest({ doc: { ...bundle.doc, starred: !bundle.doc.starred, updatedAt: new Date().toISOString() } }) : null;
  },
  trashDoc(docId: string) {
    return withMigration(() => trashDoc(docId));
  },
  restoreDoc(docId: string) {
    return withMigration(() => restoreDoc(docId));
  },
  deleteDoc(docId: string) {
    return withMigration(() => deleteDocRequest(docId));
  },
  saveCitations(docId: string, citations: CitationSource[]) {
    return withMigration(() => saveDocCitations(docId, citations));
  },
  async loadPreferences() {
    try {
      return await withMigration(loadDocPreferences);
    } catch {
      return defaultDocPreferences;
    }
  },
  savePreferences(preferences: DocPreferences) {
    return withMigration(() => saveDocPreferences(preferences));
  },
};

export async function ensureSeedDoc() {
  await ensureDocsMigration();
  const docs = await fetchDocs();
  if (docs.length === 0) {
    await createDocRequest({ templateId: 'blank' });
  }
}
