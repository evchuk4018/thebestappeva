import { AiParsedAttachment, parseAiParsedAttachment } from './ai-attachments-contract';

export interface AiPdfSearchMatch {
  pageNumber: number;
  snippet: string;
}

export interface AiPdfSearchPayload {
  attachment: AiParsedAttachment;
  matchCount: number;
  matches: AiPdfSearchMatch[];
  query: string;
}

export interface AiPdfPagePayload {
  attachment: AiParsedAttachment;
  markdown: string;
  pageNumber: number;
  text: string;
}

export interface AiPdfPageContent {
  markdown: string;
  pageNumber: number;
  text: string;
}

export interface AiPdfPagesPayload {
  attachment: AiParsedAttachment;
  pageCount: number;
  pages: AiPdfPageContent[];
}

export interface AiPdfPageImagePayload {
  attachment: AiParsedAttachment;
  base64Data: string;
  cached: boolean;
  mediaType: 'image/png';
  pageNumber: number;
  text: string;
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

function expectNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}. Expected a finite number.`);
  }

  return value;
}

export function parseAiPdfSearchPayload(value: unknown, field = 'PDF search payload'): AiPdfSearchPayload {
  const record = expectRecord(value, field);
  const matches = Array.isArray(record.matches)
    ? record.matches.map((match, index) => {
        const item = expectRecord(match, `${field}.matches[${index}]`);
        return {
          pageNumber: expectNumber(item.pageNumber, `${field}.matches[${index}].pageNumber`),
          snippet: expectString(item.snippet, `${field}.matches[${index}].snippet`),
        };
      })
    : (() => {
        throw new Error(`Invalid ${field}.matches. Expected an array.`);
      })();

  return {
    attachment: parseAiParsedAttachment(record.attachment, `${field}.attachment`),
    matchCount: expectNumber(record.matchCount, `${field}.matchCount`),
    matches,
    query: expectString(record.query, `${field}.query`),
  };
}

export function parseAiPdfPagePayload(value: unknown, field = 'PDF page payload'): AiPdfPagePayload {
  const record = expectRecord(value, field);
  return {
    attachment: parseAiParsedAttachment(record.attachment, `${field}.attachment`),
    markdown: expectString(record.markdown, `${field}.markdown`),
    pageNumber: expectNumber(record.pageNumber, `${field}.pageNumber`),
    text: expectString(record.text, `${field}.text`),
  };
}

export function parseAiPdfPagesPayload(value: unknown, field = 'PDF pages payload'): AiPdfPagesPayload {
  const record = expectRecord(value, field);
  const pages = Array.isArray(record.pages)
    ? record.pages.map((page, index) => {
        const item = expectRecord(page, `${field}.pages[${index}]`);
        return {
          markdown: expectString(item.markdown, `${field}.pages[${index}].markdown`),
          pageNumber: expectNumber(item.pageNumber, `${field}.pages[${index}].pageNumber`),
          text: expectString(item.text, `${field}.pages[${index}].text`),
        };
      })
    : (() => {
        throw new Error(`Invalid ${field}.pages. Expected an array.`);
      })();

  return {
    attachment: parseAiParsedAttachment(record.attachment, `${field}.attachment`),
    pageCount: expectNumber(record.pageCount, `${field}.pageCount`),
    pages,
  };
}

export function parseAiPdfPageImagePayload(value: unknown, field = 'PDF page image payload'): AiPdfPageImagePayload {
  const record = expectRecord(value, field);
  const mediaType = expectString(record.mediaType, `${field}.mediaType`);
  if (mediaType !== 'image/png') {
    throw new Error(`Invalid ${field}.mediaType. Expected "image/png".`);
  }

  return {
    attachment: parseAiParsedAttachment(record.attachment, `${field}.attachment`),
    base64Data: expectString(record.base64Data, `${field}.base64Data`),
    cached: Boolean(record.cached),
    mediaType,
    pageNumber: expectNumber(record.pageNumber, `${field}.pageNumber`),
    text: expectString(record.text, `${field}.text`),
  };
}
