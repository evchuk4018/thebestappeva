import { defaultPageSettings } from './docs-data';
import { docsDb, mapCitationRows } from './docs-db';
import { CitationSource, DocBundle, DocRecord, DocSearchIndexEntry, DocTabRecord, DocsRepository } from './docs-types';
import { createId, stripHtml } from './docs-utils';
import { docTemplates } from './docs-data';

function createDocRecord(title: string, templateId: string, activeTabId: string): DocRecord {
  const timestamp = new Date().toISOString();
  return {
    id: createId('doc'),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: timestamp,
    starred: false,
    trashedAt: null,
    templateId,
    activeTabId,
    layoutMode: 'pages',
    zoom: 100,
    pageSettings: defaultPageSettings,
  };
}

function createTabs(docId: string, templateId: string) {
  const template = docTemplates.find((entry) => entry.id === templateId) ?? docTemplates[0];
  return template.tabs.map((tab, index) => ({
    id: createId('tab'),
    docId,
    parentTabId: null,
    title: tab.title,
    order: index,
    outlineVisible: true,
    content: tab.html,
    contentFormat: 'html' as const,
    textContent: stripHtml(tab.html),
  }));
}

async function buildBundle(doc: DocRecord): Promise<DocBundle> {
  const [tabs, versions, citations] = await Promise.all([
    docsDb.tabs.where('docId').equals(doc.id).sortBy('order'),
    docsDb.versions.where('docId').equals(doc.id).reverse().sortBy('createdAt'),
    docsDb.citations.where('docId').equals(doc.id).toArray(),
  ]);
  return { doc, tabs, versions: versions.reverse(), citations: mapCitationRows(citations) };
}

export const docsRepository: DocsRepository = {
  async listDocs() {
    const docs = await docsDb.docs.toArray();
    const tabs = await docsDb.tabs.toArray();
    const firstTabByDoc = new Map<string, DocTabRecord>();

    for (const tab of tabs.sort((left, right) => left.order - right.order)) {
      if (!firstTabByDoc.has(tab.docId)) firstTabByDoc.set(tab.docId, tab);
    }

    return docs
      .map((doc) => ({
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
        lastOpenedAt: doc.lastOpenedAt,
        starred: doc.starred,
        trashedAt: doc.trashedAt,
        preview: firstTabByDoc.get(doc.id)?.textContent ?? '',
      }))
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  },
  async createDoc(templateId = 'blank') {
    const template = docTemplates.find((entry) => entry.id === templateId) ?? docTemplates[0];
    const tempDocId = createId('doc');
    const tabs = createTabs(tempDocId, template.id);
    const doc = createDocRecord(template.title, template.id, tabs[0].id);
    doc.id = tempDocId;

    await docsDb.transaction('rw', docsDb.docs, docsDb.tabs, async () => {
      await docsDb.docs.add(doc);
      await docsDb.tabs.bulkAdd(tabs);
    });

    return buildBundle(doc);
  },
  async createImportedDoc(title: string, html: string) {
    const tempDocId = createId('doc');
    const tab: DocTabRecord = {
      id: createId('tab'),
      docId: tempDocId,
      parentTabId: null,
      title: 'Imported',
      order: 0,
      outlineVisible: true,
      content: html,
      contentFormat: 'html',
      textContent: stripHtml(html),
    };
    const doc = createDocRecord(title, 'blank', tab.id);
    doc.id = tempDocId;

    await docsDb.transaction('rw', docsDb.docs, docsDb.tabs, docsDb.versions, async () => {
      await docsDb.docs.add(doc);
      await docsDb.tabs.add(tab);
    });

    return buildBundle(doc);
  },
  async getDocBundle(docId) {
    const doc = await docsDb.docs.get(docId);
    if (!doc) return null;
    const nextDoc = { ...doc, lastOpenedAt: new Date().toISOString() };
    await docsDb.docs.put(nextDoc);
    return buildBundle(nextDoc);
  },
  async saveDoc(doc) {
    await docsDb.docs.put({ ...doc, updatedAt: new Date().toISOString() });
  },
  async saveTab(tab) {
    await docsDb.tabs.put(tab);
  },
  async saveTabs(tabs) {
    await docsDb.tabs.bulkPut(tabs);
  },
  async duplicateDoc(docId) {
    const bundle = await this.getDocBundle(docId);
    if (!bundle) return null;

    const copiedTabs = bundle.tabs.map((tab) => ({
      ...tab,
      id: createId('tab'),
      docId: '',
    }));
    const duplicated = createDocRecord(`${bundle.doc.title} Copy`, bundle.doc.templateId, copiedTabs[0].id);
    copiedTabs.forEach((tab) => { tab.docId = duplicated.id; });

    await docsDb.transaction('rw', docsDb.docs, docsDb.tabs, async () => {
      await docsDb.docs.add(duplicated);
      await docsDb.tabs.bulkAdd(copiedTabs);
    });

    return buildBundle(duplicated);
  },
  async renameDoc(docId, title) {
    const doc = await docsDb.docs.get(docId);
    if (!doc) return;
    await docsDb.docs.put({ ...doc, title, updatedAt: new Date().toISOString() });
  },
  async toggleStar(docId) {
    const doc = await docsDb.docs.get(docId);
    if (!doc) return;
    await docsDb.docs.put({ ...doc, starred: !doc.starred, updatedAt: new Date().toISOString() });
  },
  async trashDoc(docId) {
    const doc = await docsDb.docs.get(docId);
    if (!doc) return;
    await docsDb.docs.put({ ...doc, trashedAt: new Date().toISOString() });
  },
  async restoreDoc(docId) {
    const doc = await docsDb.docs.get(docId);
    if (!doc) return;
    await docsDb.docs.put({ ...doc, trashedAt: null, updatedAt: new Date().toISOString() });
  },
  async deleteDoc(docId) {
    const tabIds = (await docsDb.tabs.where('docId').equals(docId).primaryKeys()) as string[];
    const versionIds = (await docsDb.versions.where('docId').equals(docId).primaryKeys()) as string[];
    const citationIds = (await docsDb.citations.where('docId').equals(docId).primaryKeys()) as string[];

    await docsDb.transaction('rw', docsDb.docs, docsDb.tabs, docsDb.versions, docsDb.citations, async () => {
      await docsDb.docs.delete(docId);
      await docsDb.tabs.bulkDelete(tabIds);
      await docsDb.versions.bulkDelete(versionIds);
      await docsDb.citations.bulkDelete(citationIds);
    });
  },
  async saveCitations(docId, citations: CitationSource[]) {
    const rows = citations.map((citation) => ({ ...citation, docId }));
    const staleIds = (await docsDb.citations.where('docId').equals(docId).primaryKeys()) as string[];

    await docsDb.transaction('rw', docsDb.citations, async () => {
      await docsDb.citations.bulkDelete(staleIds);
      await docsDb.citations.bulkPut(rows);
    });
  },
};

export async function ensureSeedDoc() {
  const count = await docsDb.docs.count();
  if (count === 0) await docsRepository.createDoc('blank');
}
