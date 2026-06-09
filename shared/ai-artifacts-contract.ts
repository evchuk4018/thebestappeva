export type ArtifactContextMode = 'full' | 'chunked' | 'selection' | 'summary';
export type ArtifactPatchMode = 'replace_lines' | 'replace_range' | 'replace_section' | 'append' | 'prepend';
export type ArtifactSearchMode = 'keyword' | 'heading' | 'hybrid';
export type ArtifactSearchMatchType = 'keyword' | 'heading' | 'hybrid';
export type ArtifactExportMode = 'create_new' | 'update_linked' | 'create_or_update_linked';
export type ArtifactTableOperation =
  | 'create_table'
  | 'insert_row_above'
  | 'insert_row_below'
  | 'delete_row'
  | 'insert_column_left'
  | 'insert_column_right'
  | 'delete_column'
  | 'update_cell'
  | 'replace_table';

export interface ArtifactContextPolicy {
  mode: ArtifactContextMode;
  maxChars?: number;
  chunkSize?: number;
  overlap?: number;
  summary?: string;
}

export interface ArtifactSummary {
  artifactId: string;
  title: string;
  type: string;
  updatedAt: string;
  lineCount: number;
  charCount: number;
  preview?: string;
  linkedDocId?: string | null;
}

export interface ArtifactCardSummary extends ArtifactSummary {}

export interface ArtifactRecord extends ArtifactSummary {
  sessionId: string;
  schemaVersion: number;
  content: string;
  contextPolicy: ArtifactContextPolicy;
  citations: string[];
  createdAt: string;
  lastExportedAt?: string | null;
}

export interface ArtifactVersionRecord {
  versionId: string;
  artifactId: string;
  createdAt: string;
  reason: string;
  actor: 'assistant' | 'user' | 'system';
}

export interface ArtifactChangedRange {
  startLine: number;
  endLine: number;
}

export interface ArtifactPatchRequest {
  mode: ArtifactPatchMode;
  startLine?: number;
  endLine?: number;
  startOffset?: number;
  endOffset?: number;
  sectionHeading?: string;
  text: string;
}

export interface UpdateArtifactRequest {
  artifactId: string;
  title?: string;
  type?: string;
  contextPolicy?: Partial<ArtifactContextPolicy>;
  content?: string;
  patch?: ArtifactPatchRequest;
  reason: string;
}

export interface ArtifactSearchMatch {
  lineStart: number;
  lineEnd: number;
  snippet: string;
  matchType: ArtifactSearchMatchType;
}

export interface ArtifactSearchResponse {
  artifactId: string;
  title: string;
  totalMatches: number;
  matches: ArtifactSearchMatch[];
}

export interface ArtifactOutlineEntry {
  heading: string;
  level: number;
  lineStart: number;
  lineEnd?: number;
  preview?: string;
}

export interface ArtifactOutlineResponse {
  artifactId: string;
  title: string;
  outline: ArtifactOutlineEntry[];
}

export interface ArtifactLineResponse {
  artifactId: string;
  title: string;
  startLine: number;
  endLine: number;
  lines: string[];
}

export interface ExportArtifactToDocResponse {
  artifactId: string;
  docId: string;
  title: string;
  action: 'created' | 'updated';
  openUrl?: string;
  linkedDocId?: string;
}

export interface ArtifactTableLocatorByHeading {
  heading?: string;
  tableIndex?: number;
}

export interface ArtifactTableLocatorByRange {
  startLine: number;
  endLine: number;
}

export interface UpdateArtifactTableRequest {
  artifactId: string;
  tableLocator: ArtifactTableLocatorByHeading | ArtifactTableLocatorByRange;
  operation: ArtifactTableOperation;
  rowIndex?: number;
  columnIndex?: number;
  cellText?: string;
  headers?: string[];
  rows?: string[][];
  markdownTable?: string;
  reason: string;
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

function expectOptionalString(value: unknown, field: string) {
  return typeof value === 'undefined' ? undefined : expectString(value, field);
}

function expectNullableString(value: unknown, field: string) {
  return value === null ? null : expectString(value, field);
}

function expectNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new Error(`Invalid ${field}. Expected a number.`);
  return value;
}

function expectOptionalNumber(value: unknown, field: string) {
  return typeof value === 'undefined' ? undefined : expectNumber(value, field);
}

function expectStringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value.map((entry, index) => expectString(entry, `${field}[${index}]`));
}

export function parseArtifactContextPolicy(value: unknown, field = 'Artifact context policy'): ArtifactContextPolicy {
  const record = expectRecord(value, field);
  const mode = expectString(record.mode, `${field}.mode`) as ArtifactContextMode;
  return {
    mode,
    maxChars: expectOptionalNumber(record.maxChars, `${field}.maxChars`),
    chunkSize: expectOptionalNumber(record.chunkSize, `${field}.chunkSize`),
    overlap: expectOptionalNumber(record.overlap, `${field}.overlap`),
    summary: expectOptionalString(record.summary, `${field}.summary`),
  };
}

export function parseArtifactSummary(value: unknown, field = 'Artifact summary'): ArtifactSummary {
  const record = expectRecord(value, field);
  return {
    artifactId: expectString(record.artifactId, `${field}.artifactId`),
    title: expectString(record.title, `${field}.title`),
    type: expectString(record.type, `${field}.type`),
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
    lineCount: expectNumber(record.lineCount, `${field}.lineCount`),
    charCount: expectNumber(record.charCount, `${field}.charCount`),
    preview: expectOptionalString(record.preview, `${field}.preview`),
    linkedDocId: typeof record.linkedDocId === 'undefined' ? undefined : expectNullableString(record.linkedDocId, `${field}.linkedDocId`),
  };
}

export function parseArtifactCardSummary(value: unknown, field = 'Artifact card summary'): ArtifactCardSummary {
  return parseArtifactSummary(value, field);
}

export function parseArtifactRecord(value: unknown, field = 'Artifact'): ArtifactRecord {
  const record = expectRecord(value, field);
  return {
    ...parseArtifactSummary(record, field),
    sessionId: expectString(record.sessionId, `${field}.sessionId`),
    schemaVersion: expectNumber(record.schemaVersion, `${field}.schemaVersion`),
    content: expectString(record.content, `${field}.content`),
    contextPolicy: parseArtifactContextPolicy(record.contextPolicy, `${field}.contextPolicy`),
    citations: Array.isArray(record.citations) ? expectStringArray(record.citations, `${field}.citations`) : [],
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    lastExportedAt: typeof record.lastExportedAt === 'undefined' ? undefined : expectNullableString(record.lastExportedAt, `${field}.lastExportedAt`),
  };
}

export function parseArtifactVersionRecord(value: unknown, field = 'Artifact version'): ArtifactVersionRecord {
  const record = expectRecord(value, field);
  return {
    versionId: expectString(record.versionId, `${field}.versionId`),
    artifactId: expectString(record.artifactId, `${field}.artifactId`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    reason: expectString(record.reason, `${field}.reason`),
    actor: expectString(record.actor, `${field}.actor`) as ArtifactVersionRecord['actor'],
  };
}

export function parseArtifactChangedRange(value: unknown, field = 'Artifact changed range'): ArtifactChangedRange {
  const record = expectRecord(value, field);
  return {
    startLine: expectNumber(record.startLine, `${field}.startLine`),
    endLine: expectNumber(record.endLine, `${field}.endLine`),
  };
}

export function parseArtifactSearchResponse(value: unknown, field = 'Artifact search response'): ArtifactSearchResponse {
  const record = expectRecord(value, field);
  return {
    artifactId: expectString(record.artifactId, `${field}.artifactId`),
    title: expectString(record.title, `${field}.title`),
    totalMatches: expectNumber(record.totalMatches, `${field}.totalMatches`),
    matches: Array.isArray(record.matches)
      ? record.matches.map((entry, index) => {
          const item = expectRecord(entry, `${field}.matches[${index}]`);
          return {
            lineStart: expectNumber(item.lineStart, `${field}.matches[${index}].lineStart`),
            lineEnd: expectNumber(item.lineEnd, `${field}.matches[${index}].lineEnd`),
            snippet: expectString(item.snippet, `${field}.matches[${index}].snippet`),
            matchType: expectString(item.matchType, `${field}.matches[${index}].matchType`) as ArtifactSearchMatchType,
          };
        })
      : [],
  };
}

export function parseArtifactOutlineResponse(value: unknown, field = 'Artifact outline response'): ArtifactOutlineResponse {
  const record = expectRecord(value, field);
  return {
    artifactId: expectString(record.artifactId, `${field}.artifactId`),
    title: expectString(record.title, `${field}.title`),
    outline: Array.isArray(record.outline)
      ? record.outline.map((entry, index) => {
          const item = expectRecord(entry, `${field}.outline[${index}]`);
          return {
            heading: expectString(item.heading, `${field}.outline[${index}].heading`),
            level: expectNumber(item.level, `${field}.outline[${index}].level`),
            lineStart: expectNumber(item.lineStart, `${field}.outline[${index}].lineStart`),
            lineEnd: expectOptionalNumber(item.lineEnd, `${field}.outline[${index}].lineEnd`),
            preview: expectOptionalString(item.preview, `${field}.outline[${index}].preview`),
          };
        })
      : [],
  };
}

export function parseArtifactLineResponse(value: unknown, field = 'Artifact line response'): ArtifactLineResponse {
  const record = expectRecord(value, field);
  return {
    artifactId: expectString(record.artifactId, `${field}.artifactId`),
    title: expectString(record.title, `${field}.title`),
    startLine: expectNumber(record.startLine, `${field}.startLine`),
    endLine: expectNumber(record.endLine, `${field}.endLine`),
    lines: Array.isArray(record.lines) ? expectStringArray(record.lines, `${field}.lines`) : [],
  };
}

export function parseExportArtifactToDocResponse(value: unknown, field = 'Artifact export response'): ExportArtifactToDocResponse {
  const record = expectRecord(value, field);
  return {
    artifactId: expectString(record.artifactId, `${field}.artifactId`),
    docId: expectString(record.docId, `${field}.docId`),
    title: expectString(record.title, `${field}.title`),
    action: expectString(record.action, `${field}.action`) as ExportArtifactToDocResponse['action'],
    openUrl: expectOptionalString(record.openUrl, `${field}.openUrl`),
    linkedDocId: expectOptionalString(record.linkedDocId, `${field}.linkedDocId`),
  };
}
