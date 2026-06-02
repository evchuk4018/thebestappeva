import Dexie, { Table } from 'dexie';
import { CitationSource, DocRecord, DocTabRecord, DocVersionRecord } from './docs-types';

interface CitationRow {
  id: string;
  docId: string;
  label: string;
  details: string;
}

class DocsDatabase extends Dexie {
  docs!: Table<DocRecord, string>;
  tabs!: Table<DocTabRecord, string>;
  versions!: Table<DocVersionRecord, string>;
  citations!: Table<CitationRow, string>;

  constructor() {
    super('docs-workspace');
    this.version(1).stores({
      docs: 'id, updatedAt, lastOpenedAt, trashedAt, starred',
      tabs: 'id, docId, order, parentTabId',
      versions: 'id, docId, createdAt, kind',
      citations: 'id, docId',
    });
  }
}

export const docsDb = new DocsDatabase();

export function mapCitationRows(rows: CitationRow[]): CitationSource[] {
  return rows.map(({ id, label, details }) => ({ id, label, details }));
}
