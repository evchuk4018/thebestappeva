import { HttpError } from '../http';
import { StoredAiAttachmentPage } from './types';

export const MAX_PDF_PAGE_RANGE = 25;

export function classifyPdfReaderMode(pageCount: number | null | undefined) {
  return pageCount !== null && typeof pageCount !== 'undefined' && pageCount > 0 && pageCount <= 3 ? 'inline' : 'tool';
}

export function findPdfPage(pages: StoredAiAttachmentPage[], pageNumber: number) {
  const page = pages.find((candidate) => candidate.pageNumber === pageNumber);
  if (!page) {
    throw new HttpError(400, `Page ${pageNumber} is outside this PDF's 1-${pages.length} page range.`);
  }

  return page;
}

export function selectPdfPageRange(
  pages: StoredAiAttachmentPage[],
  startPage = 1,
  endPage = pages.length,
) {
  if (!Number.isInteger(startPage) || startPage < 1) {
    throw new HttpError(400, 'startPage must be a positive integer.');
  }

  if (!Number.isInteger(endPage) || endPage < startPage) {
    throw new HttpError(400, 'endPage must be an integer greater than or equal to startPage.');
  }

  if (startPage > pages.length) {
    throw new HttpError(400, `Page ${startPage} is outside this PDF's 1-${pages.length} page range.`);
  }

  const cappedEndPage = Math.min(endPage, startPage + MAX_PDF_PAGE_RANGE - 1, pages.length);
  return pages.filter((page) => page.pageNumber >= startPage && page.pageNumber <= cappedEndPage);
}

function buildSnippet(text: string, index: number, queryLength: number) {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + queryLength + 120);
  return `${start ? '...' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '...' : ''}`;
}

export function searchPdfPages(pages: StoredAiAttachmentPage[], query: string, limit = 10) {
  const needle = query.toLowerCase();
  const matches: Array<{ pageNumber: number; snippet: string }> = [];

  for (const page of pages) {
    const haystack = page.text.toLowerCase();
    let offset = 0;
    while (matches.length < limit) {
      const index = haystack.indexOf(needle, offset);
      if (index < 0) break;
      matches.push({ pageNumber: page.pageNumber, snippet: buildSnippet(page.text, index, query.length) });
      offset = index + Math.max(query.length, 1);
    }
    if (matches.length >= limit) break;
  }

  return matches;
}
