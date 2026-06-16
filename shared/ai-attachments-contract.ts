export type AiAttachmentKind = 'document' | 'image';
export type AiAttachmentParser = 'docling';
export type AiImageSummaryStatus = 'ready';

export interface AiAttachmentStats {
  pageCount: number | null;
  sheetCount: number | null;
}

export interface AiAttachmentBase {
  id: string;
  kind: AiAttachmentKind;
  fileName: string;
  mediaType: string;
  fileSize: number;
}

export interface AiDocumentAttachmentReference extends AiAttachmentBase {
  kind: 'document';
  parser: AiAttachmentParser;
  title: string;
  textChars: number;
  chunkCount: number;
  warningCount: number;
  pageCount?: number | null;
  pdfReaderMode?: 'inline' | 'tool';
}

export interface AiImageAttachmentReference extends AiAttachmentBase {
  kind: 'image';
  width?: number | null;
  height?: number | null;
  summary: string;
  summaryModel: string;
  summaryStatus: AiImageSummaryStatus;
}

export type AiAttachmentReference = AiDocumentAttachmentReference | AiImageAttachmentReference;

export interface AiDocumentAttachment extends AiDocumentAttachmentReference {
  createdAt: string;
  outline: string[];
  warnings: string[];
  stats: AiAttachmentStats;
  previewText: string;
}

export interface AiImageAttachment extends AiImageAttachmentReference {
  createdAt: string;
}

export type AiParsedAttachment = AiDocumentAttachment | AiImageAttachment;

export interface AiAttachmentContextPayload {
  attachment: AiDocumentAttachment;
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
  return typeof value === 'undefined' ? undefined : expectString(value, field);
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

function parseAttachmentBase(record: Record<string, unknown>, field: string): AiAttachmentBase {
  const kind = expectString(record.kind, `${field}.kind`);
  if (kind !== 'document' && kind !== 'image') {
    throw new Error(`Invalid ${field}.kind. Expected "document" or "image".`);
  }

  return {
    id: expectString(record.id, `${field}.id`),
    kind,
    fileName: expectString(record.fileName, `${field}.fileName`),
    mediaType: expectString(record.mediaType, `${field}.mediaType`),
    fileSize: expectNumber(record.fileSize, `${field}.fileSize`),
  };
}

export function parseAiAttachmentReference(value: unknown, field = 'AI attachment'): AiAttachmentReference {
  const record = expectRecord(value, field);
  const base = parseAttachmentBase(record, field);

  if (base.kind === 'image') {
    const summaryStatus = expectString(record.summaryStatus, `${field}.summaryStatus`);
    if (summaryStatus !== 'ready') {
      throw new Error(`Invalid ${field}.summaryStatus. Expected "ready".`);
    }

    return {
      ...base,
      kind: 'image',
      width: expectOptionalNullableNumber(record.width, `${field}.width`),
      height: expectOptionalNullableNumber(record.height, `${field}.height`),
      summary: expectString(record.summary, `${field}.summary`),
      summaryModel: expectString(record.summaryModel, `${field}.summaryModel`),
      summaryStatus,
    };
  }

  const parser = expectString(record.parser, `${field}.parser`);
  if (parser !== 'docling') {
    throw new Error(`Invalid ${field}.parser. Expected "docling".`);
  }

  return {
    ...base,
    kind: 'document',
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
  const attachment = parseAiAttachmentReference(record, field);
  const createdAt = expectString(record.createdAt, `${field}.createdAt`);

  if (attachment.kind === 'image') {
    return {
      ...attachment,
      createdAt,
    };
  }

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
    ...attachment,
    createdAt,
    outline,
    warnings,
    stats: parseStats(record.stats, `${field}.stats`),
    previewText: expectString(record.previewText, `${field}.previewText`),
  };
}

export function parseAiDocumentAttachment(value: unknown, field = 'Document attachment'): AiDocumentAttachment {
  const attachment = parseAiParsedAttachment(value, field);
  if (attachment.kind !== 'document') {
    throw new Error(`Invalid ${field}. Expected a document attachment.`);
  }
  return attachment;
}

export function parseAiAttachmentContextPayload(value: unknown, field = 'AI attachment context'): AiAttachmentContextPayload {
  const record = expectRecord(value, field);
  const mode = expectString(record.mode, `${field}.mode`);
  if (mode !== 'inline' && mode !== 'ranked') {
    throw new Error(`Invalid ${field}.mode. Expected "inline" or "ranked".`);
  }

  return {
    attachment: parseAiDocumentAttachment(record.attachment, `${field}.attachment`),
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
