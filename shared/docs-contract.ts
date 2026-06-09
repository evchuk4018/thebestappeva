export type DocLayoutMode = 'pages' | 'pageless';
export type DocVersionKind = 'auto' | 'named' | 'import' | 'restore';
export type DocSort = 'lastOpenedAt' | 'updatedAt' | 'title';
export type DocContentFormat = 'html' | 'json';

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
  contentFormat: DocContentFormat;
  textContent: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocVersionSummary {
  id: string;
  docId: string;
  tabId: string | null;
  createdAt: string;
  label: string;
  kind: DocVersionKind;
  snapshotTitle: string;
}

export interface DocVersionDetail extends DocVersionSummary {
  content: string;
  contentFormat: DocContentFormat;
}

export interface CitationSource {
  id: string;
  label: string;
  details: string;
}

export interface DocCitationRecord extends CitationSource {
  docId: string;
}

export interface DocBundle {
  doc: DocRecord;
  tabs: DocTabRecord[];
  versions: DocVersionSummary[];
  nextVersionCursor: string | null;
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

export interface CreateDocRequest {
  templateId?: string;
}

export interface CreateImportedDocRequest {
  title: string;
  html: string;
}

export interface SaveDocRequest {
  doc: DocRecord;
  tab?: DocTabRecord;
  version?: {
    kind: DocVersionKind;
    label?: string | null;
  };
}

export interface SaveTabsRequest {
  tabs: DocTabRecord[];
}

export interface SaveCitationsRequest {
  citations: CitationSource[];
}

export interface ListDocVersionsResponse {
  versions: DocVersionSummary[];
  nextCursor: string | null;
}

export interface RestoreVersionResponse {
  version: DocVersionDetail;
}

export interface DocsMigrationImportRequest {
  sourceKey: string;
  docs: DocRecord[];
  tabs: DocTabRecord[];
  versions: DocVersionDetail[];
  citations: DocCitationRecord[];
  preferences: DocPreferences | null;
}

export interface DocsMigrationStatusResponse {
  migrated: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value;
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') throw new Error(`Invalid ${field}. Expected a string.`);
  return value;
}

function expectNullableString(value: unknown, field: string) {
  if (value === null) return null;
  return expectString(value, field);
}

function expectBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}. Expected a boolean.`);
  return value;
}

function expectNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`Invalid ${field}. Expected a number.`);
  return value;
}

function expectArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value;
}

export function parseDocPreferences(value: unknown, field = 'Doc preferences'): DocPreferences {
  const record = expectRecord(value, field);
  const sort = expectString(record.sort, `${field}.sort`);
  if (sort !== 'lastOpenedAt' && sort !== 'updatedAt' && sort !== 'title') {
    throw new Error(`Invalid ${field}.sort. Expected "lastOpenedAt", "updatedAt", or "title".`);
  }

  return {
    sort,
    showTemplates: expectBoolean(record.showTemplates, `${field}.showTemplates`),
  };
}

function parsePageSettings(value: unknown, field: string): DocPageSettings {
  const record = expectRecord(value, field);
  const margins = expectRecord(record.margins, `${field}.margins`);
  return {
    paperSize: expectString(record.paperSize, `${field}.paperSize`) as DocPageSettings['paperSize'],
    orientation: expectString(record.orientation, `${field}.orientation`) as DocPageSettings['orientation'],
    pageColor: expectString(record.pageColor, `${field}.pageColor`),
    margins: {
      top: expectNumber(margins.top, `${field}.margins.top`),
      right: expectNumber(margins.right, `${field}.margins.right`),
      bottom: expectNumber(margins.bottom, `${field}.margins.bottom`),
      left: expectNumber(margins.left, `${field}.margins.left`),
    },
  };
}

export function parseDocRecord(value: unknown, field = 'Document'): DocRecord {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    title: expectString(record.title, `${field}.title`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
    lastOpenedAt: expectString(record.lastOpenedAt, `${field}.lastOpenedAt`),
    starred: expectBoolean(record.starred, `${field}.starred`),
    trashedAt: expectNullableString(record.trashedAt, `${field}.trashedAt`),
    templateId: expectString(record.templateId, `${field}.templateId`),
    activeTabId: expectString(record.activeTabId, `${field}.activeTabId`),
    layoutMode: expectString(record.layoutMode, `${field}.layoutMode`) as DocLayoutMode,
    zoom: expectNumber(record.zoom, `${field}.zoom`),
    pageSettings: parsePageSettings(record.pageSettings, `${field}.pageSettings`),
  };
}

export function parseDocTabRecord(value: unknown, field = 'Document tab'): DocTabRecord {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    docId: expectString(record.docId, `${field}.docId`),
    parentTabId: expectNullableString(record.parentTabId, `${field}.parentTabId`),
    title: expectString(record.title, `${field}.title`),
    order: expectNumber(record.order, `${field}.order`),
    outlineVisible: expectBoolean(record.outlineVisible, `${field}.outlineVisible`),
    content: expectString(record.content, `${field}.content`),
    contentFormat: expectString(record.contentFormat, `${field}.contentFormat`) as DocContentFormat,
    textContent: expectString(record.textContent, `${field}.textContent`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
  };
}

function parseDocVersionBase(value: unknown, field: string): DocVersionSummary {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    docId: expectString(record.docId, `${field}.docId`),
    tabId: expectNullableString(record.tabId, `${field}.tabId`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    label: expectString(record.label, `${field}.label`),
    kind: expectString(record.kind, `${field}.kind`) as DocVersionKind,
    snapshotTitle: expectString(record.snapshotTitle, `${field}.snapshotTitle`),
  };
}

export function parseDocVersionDetail(value: unknown, field = 'Document version'): DocVersionDetail {
  const record = expectRecord(value, field);
  return {
    ...parseDocVersionBase(record, field),
    content: expectString(record.content, `${field}.content`),
    contentFormat: expectString(record.contentFormat, `${field}.contentFormat`) as DocContentFormat,
  };
}

export function parseDocBundle(value: unknown, field = 'Document bundle'): DocBundle {
  const record = expectRecord(value, field);
  return {
    doc: parseDocRecord(record.doc, `${field}.doc`),
    tabs: expectArray(record.tabs, `${field}.tabs`).map((entry, index) => parseDocTabRecord(entry, `${field}.tabs[${index}]`)),
    versions: expectArray(record.versions, `${field}.versions`).map((entry, index) => parseDocVersionBase(entry, `${field}.versions[${index}]`)),
    nextVersionCursor: record.nextVersionCursor === null ? null : expectString(record.nextVersionCursor, `${field}.nextVersionCursor`),
    citations: expectArray(record.citations, `${field}.citations`).map((entry, index) => parseCitationSource(entry, `${field}.citations[${index}]`)),
  };
}

export function parseCitationSource(value: unknown, field = 'Citation'): CitationSource {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    label: expectString(record.label, `${field}.label`),
    details: expectString(record.details, `${field}.details`),
  };
}

export function parseDocSearchIndexEntry(value: unknown, field = 'Document search entry'): DocSearchIndexEntry {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    title: expectString(record.title, `${field}.title`),
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
    lastOpenedAt: expectString(record.lastOpenedAt, `${field}.lastOpenedAt`),
    starred: expectBoolean(record.starred, `${field}.starred`),
    trashedAt: expectNullableString(record.trashedAt, `${field}.trashedAt`),
    preview: expectString(record.preview, `${field}.preview`),
  };
}

export function parseListDocVersionsResponse(value: unknown, field = 'Document versions'): ListDocVersionsResponse {
  const record = expectRecord(value, field);
  return {
    versions: expectArray(record.versions, `${field}.versions`).map((entry, index) => parseDocVersionBase(entry, `${field}.versions[${index}]`)),
    nextCursor: record.nextCursor === null ? null : expectString(record.nextCursor, `${field}.nextCursor`),
  };
}

export function parseDocsMigrationStatusResponse(value: unknown, field = 'Docs migration status'): DocsMigrationStatusResponse {
  const record = expectRecord(value, field);
  return { migrated: expectBoolean(record.migrated, `${field}.migrated`) };
}
