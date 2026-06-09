import type { DocTabRecord, DocVersionKind, SaveDocRequest } from '../../../shared/docs-contract';

export type {
  CitationSource,
  CreateDocRequest,
  CreateImportedDocRequest,
  DocBundle,
  DocContentFormat,
  DocLayoutMode,
  DocMarginSettings,
  DocPageSettings,
  DocPreferences,
  DocRecord,
  DocSearchIndexEntry,
  DocSort,
  DocTemplate,
  DocTabRecord,
  DocVersionDetail,
  DocVersionKind,
  DocVersionSummary,
  DocsMigrationImportRequest,
  DocsMigrationStatusResponse,
  ListDocVersionsResponse,
  RestoreVersionResponse,
  SaveCitationsRequest,
  SaveDocRequest,
  SaveTabsRequest,
} from '../../../shared/docs-contract';

export interface DocsRepository {
  listDocs(): Promise<import('../../../shared/docs-contract').DocSearchIndexEntry[]>;
  createDoc(templateId?: string): Promise<import('../../../shared/docs-contract').DocBundle>;
  createImportedDoc(title: string, html: string): Promise<import('../../../shared/docs-contract').DocBundle>;
  getDocBundle(docId: string, cursor?: string | null): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  saveDoc(request: SaveDocRequest, options?: { keepalive?: boolean }): Promise<import('../../../shared/docs-contract').DocBundle>;
  saveTab(tab: DocTabRecord): Promise<import('../../../shared/docs-contract').DocBundle>;
  saveTabs(tabs: DocTabRecord[]): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  loadMoreVersions(docId: string, cursor: string): Promise<import('../../../shared/docs-contract').ListDocVersionsResponse>;
  getVersion(docId: string, versionId: string): Promise<import('../../../shared/docs-contract').DocVersionDetail>;
  createVersion(docId: string, request: SaveDocRequest): Promise<import('../../../shared/docs-contract').DocBundle>;
  restoreVersion(docId: string, versionId: string): Promise<import('../../../shared/docs-contract').DocBundle>;
  duplicateDoc(docId: string): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  renameDoc(docId: string, title: string): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  toggleStar(docId: string): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  trashDoc(docId: string): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  restoreDoc(docId: string): Promise<import('../../../shared/docs-contract').DocBundle | null>;
  deleteDoc(docId: string): Promise<void>;
  saveCitations(docId: string, citations: import('../../../shared/docs-contract').CitationSource[]): Promise<import('../../../shared/docs-contract').CitationSource[]>;
  loadPreferences(): Promise<import('../../../shared/docs-contract').DocPreferences>;
  savePreferences(preferences: import('../../../shared/docs-contract').DocPreferences): Promise<import('../../../shared/docs-contract').DocPreferences>;
}

export interface VersionSaveOptions {
  kind: DocVersionKind;
  label?: string;
}
