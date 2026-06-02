export type DocLayoutMode = 'pages' | 'pageless';
export type DocVersionKind = 'auto' | 'named' | 'import' | 'restore';
export type DocSort = 'lastOpenedAt' | 'updatedAt' | 'title';

export interface DocMarginSettings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DocPageSettings {
  paperSize: 'Letter' | 'A4';
  orientation: 'portrait' | 'landscape';
  pageColor: string;
  margins: DocMarginSettings;
}

export interface DocPreferences {
  sort: DocSort;
  showTemplates: boolean;
}

export interface DocRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  starred: boolean;
  trashedAt: string | null;
  templateId: string;
  activeTabId: string;
  layoutMode: DocLayoutMode;
  zoom: number;
  pageSettings: DocPageSettings;
}

export interface DocTabRecord {
  id: string;
  docId: string;
  parentTabId: string | null;
  title: string;
  order: number;
  outlineVisible: boolean;
  content: string;
  contentFormat: 'html' | 'json';
  textContent: string;
}

export interface DocVersionRecord {
  id: string;
  docId: string;
  tabId: string | null;
  createdAt: string;
  label: string;
  kind: DocVersionKind;
  content: string;
  contentFormat: 'html' | 'json';
  snapshotTitle: string;
}

export interface CitationSource {
  id: string;
  label: string;
  details: string;
}

export interface DocBundle {
  doc: DocRecord;
  tabs: DocTabRecord[];
  versions: DocVersionRecord[];
  citations: CitationSource[];
}

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  title: string;
  tabs: Array<{
    title: string;
    parentTabId: string | null;
    html: string;
  }>;
}

export interface DocSearchIndexEntry {
  id: string;
  title: string;
  updatedAt: string;
  lastOpenedAt: string;
  starred: boolean;
  trashedAt: string | null;
  preview: string;
}

export interface DocsRepository {
  listDocs(): Promise<DocSearchIndexEntry[]>;
  createDoc(templateId?: string): Promise<DocBundle>;
  createImportedDoc(title: string, html: string): Promise<DocBundle>;
  getDocBundle(docId: string): Promise<DocBundle | null>;
  saveDoc(doc: DocRecord): Promise<void>;
  saveTab(tab: DocTabRecord): Promise<void>;
  saveTabs(tabs: DocTabRecord[]): Promise<void>;
  duplicateDoc(docId: string): Promise<DocBundle | null>;
  renameDoc(docId: string, title: string): Promise<void>;
  toggleStar(docId: string): Promise<void>;
  trashDoc(docId: string): Promise<void>;
  restoreDoc(docId: string): Promise<void>;
  deleteDoc(docId: string): Promise<void>;
  saveCitations(docId: string, citations: CitationSource[]): Promise<void>;
}
