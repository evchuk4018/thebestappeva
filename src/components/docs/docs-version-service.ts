import { docsDb } from './docs-db';
import { DocRecord, DocTabRecord, DocVersionKind, DocVersionRecord } from './docs-types';
import { createId, createTimestampLabel } from './docs-utils';

function buildVersion(
  doc: DocRecord,
  tab: DocTabRecord,
  kind: DocVersionKind,
  label: string,
): DocVersionRecord {
  return {
    id: createId('version'),
    docId: doc.id,
    tabId: tab.id,
    createdAt: new Date().toISOString(),
    label,
    kind,
    content: tab.content,
    contentFormat: tab.contentFormat,
    snapshotTitle: doc.title,
  };
}

export const docsVersionService = {
  async createVersion(doc: DocRecord, tab: DocTabRecord, kind: DocVersionKind, label?: string) {
    const version = buildVersion(doc, tab, kind, label ?? `${kind === 'named' ? 'Named version' : 'Autosave'} • ${createTimestampLabel()}`);
    await docsDb.versions.add(version);

    if (kind === 'auto') {
      const autosaves = await docsDb.versions.where({ docId: doc.id, kind: 'auto' }).sortBy('createdAt');
      const overflow = autosaves.slice(0, Math.max(0, autosaves.length - 50)).map((entry) => entry.id);
      if (overflow.length) await docsDb.versions.bulkDelete(overflow);
    }
  },
  async listVersions(docId: string) {
    return docsDb.versions.where('docId').equals(docId).reverse().sortBy('createdAt');
  },
};
