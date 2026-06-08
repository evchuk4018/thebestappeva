import path from 'node:path';
import { HttpError } from '../http';
import { classifyPdfReaderMode } from './pdf-content';
import { parseDocumentWithDocling } from './parser';
import { getAttachmentSourcePath, saveAttachmentRecord } from './storage';
import { StoredAiAttachmentPage, StoredAiAttachmentRecord } from './types';

export function isPdfRecord(record: StoredAiAttachmentRecord) {
  return record.sourceExtension === '.pdf' || path.extname(record.attachment.fileName).toLowerCase() === '.pdf';
}

export function getPdfReaderMode(record: StoredAiAttachmentRecord) {
  if (!isPdfRecord(record)) {
    return undefined;
  }

  const pageCount = record.attachment.pageCount ?? record.attachment.stats.pageCount;
  return classifyPdfReaderMode(pageCount);
}

function normalizePages(pages: StoredAiAttachmentPage[] | undefined) {
  return pages
    ?.filter((page) => Number.isInteger(page.pageNumber) && page.pageNumber > 0)
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

export async function ensurePdfPages(record: StoredAiAttachmentRecord) {
  if (!isPdfRecord(record)) {
    throw new HttpError(415, `"${record.attachment.fileName}" is not a PDF.`);
  }

  const existingPages = normalizePages(record.pages);
  if (existingPages?.length) {
    return existingPages;
  }

  const sourcePath = getAttachmentSourcePath(record.attachment.id, record.sourceExtension);
  const parsed = await parseDocumentWithDocling(sourcePath);
  const pages = normalizePages(parsed.pages);
  if (!pages?.length) {
    throw new HttpError(422, 'The PDF parser did not return page-level content for this document.');
  }

  record.pages = pages;
  record.attachment.stats.pageCount = parsed.stats.pageCount ?? pages.length;
  record.attachment.pageCount = record.attachment.stats.pageCount;
  record.attachment.pdfReaderMode = getPdfReaderMode(record);
  await saveAttachmentRecord(record);
  return pages;
}
