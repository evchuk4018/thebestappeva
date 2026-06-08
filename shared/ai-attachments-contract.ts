export type AiAttachmentParser = 'docling';

export interface AiAttachmentStats {
  pageCount: number | null;
  sheetCount: number | null;
}

export interface AiAttachmentReference {
  id: string;
  fileName: string;
  mediaType: string;
  fileSize: number;
  parser: AiAttachmentParser;
  title: string;
  textChars: number;
  chunkCount: number;
  warningCount: number;
  pageCount?: number | null;
  pdfReaderMode?: 'inline' | 'tool';
}

export interface AiParsedAttachment extends AiAttachmentReference {
  createdAt: string;
  outline: string[];
  warnings: string[];
  stats: AiAttachmentStats;
  previewText: string;
}

export interface AiAttachmentContextPayload {
  attachment: AiParsedAttachment;
  context: string;
  mode: 'inline' | 'ranked';
  selectedChunkCount: number;
}

export interface AiAttachmentHealth {
  available: boolean;
  parser: AiAttachmentParser;
  message: string;
  details?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }

  return value;
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}. Expected a string.`);
  }

  return value;
}

function expectOptionalString(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  return expectString(value, field);
}

function expectNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}. Expected a finite number.`);
  }

  return value;
}

function expectNullableNumber(value: unknown, field: string) {
  return value === null ? null : expectNumber(value, field);
}

function expectOptionalNullableNumber(value: unknown, field: string) {
  return typeof value === 'undefined' ? undefined : expectNullableNumber(value, field);
}

function parseOptionalPdfReaderMode(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value !== 'inline' && value !== 'tool') {
    throw new Error(`Invalid ${field}. Expected "inline" or "tool".`);
  }

  return value;
}

function parseStats(value: unknown, field: string): AiAttachmentStats {
  const record = expectRecord(value, field);
  return {
    pageCount: expectNullableNumber(record.pageCount, `${field}.pageCount`),
    sheetCount: expectNullableNumber(record.sheetCount, `${field}.sheetCount`),
  };
}

export function parseAiAttachmentReference(value: unknown, field = 'AI attachment'): AiAttachmentReference {
  const record = expectRecord(value, field);
  const parser = expectString(record.parser, `${field}.parser`);

  if (parser !== 'docling') {
    throw new Error(`Invalid ${field}.parser. Expected "docling".`);
  }

  return {
    id: expectString(record.id, `${field}.id`),
    fileName: expectString(record.fileName, `${field}.fileName`),
    mediaType: expectString(record.mediaType, `${field}.mediaType`),
    fileSize: expectNumber(record.fileSize, `${field}.fileSize`),
    parser,
    title: expectString(record.title, `${field}.title`),
    textChars: expectNumber(record.textChars, `${field}.textChars`),
    chunkCount: expectNumber(record.chunkCount, `${field}.chunkCount`),
    warningCount: expectNumber(record.warningCount, `${field}.warningCount`),
    pageCount: expectOptionalNullableNumber(record.pageCount, `${field}.pageCount`),
    pdfReaderMode: parseOptionalPdfReaderMode(record.pdfReaderMode, `${field}.pdfReaderMode`),
  };
}

export function parseAiParsedAttachment(value: unknown, field = 'Parsed AI attachment'): AiParsedAttachment {
  const record = expectRecord(value, field);
  const outline = Array.isArray(record.outline)
    ? record.outline.map((item, index) => expectString(item, `${field}.outline[${index}]`))
    : (() => {
        throw new Error(`Invalid ${field}.outline. Expected an array.`);
      })();
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.map((item, index) => expectString(item, `${field}.warnings[${index}]`))
    : (() => {
        throw new Error(`Invalid ${field}.warnings. Expected an array.`);
      })();

  return {
    ...parseAiAttachmentReference(record, field),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    outline,
    warnings,
    stats: parseStats(record.stats, `${field}.stats`),
    previewText: expectString(record.previewText, `${field}.previewText`),
  };
}

export function parseAiAttachmentContextPayload(value: unknown, field = 'AI attachment context'): AiAttachmentContextPayload {
  const record = expectRecord(value, field);
  const mode = expectString(record.mode, `${field}.mode`);

  if (mode !== 'inline' && mode !== 'ranked') {
    throw new Error(`Invalid ${field}.mode. Expected "inline" or "ranked".`);
  }

  return {
    attachment: parseAiParsedAttachment(record.attachment, `${field}.attachment`),
    context: expectString(record.context, `${field}.context`),
    mode,
    selectedChunkCount: expectNumber(record.selectedChunkCount, `${field}.selectedChunkCount`),
  };
}

export function parseAiAttachmentHealth(value: unknown, field = 'AI attachment health'): AiAttachmentHealth {
  const record = expectRecord(value, field);
  const parser = expectString(record.parser, `${field}.parser`);

  if (parser !== 'docling') {
    throw new Error(`Invalid ${field}.parser. Expected "docling".`);
  }

  return {
    available: Boolean(record.available),
    parser,
    message: expectString(record.message, `${field}.message`),
    details: expectOptionalString(record.details, `${field}.details`),
  };
}
