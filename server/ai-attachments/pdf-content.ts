import { HttpError } from '../http';
import { StoredAiAttachmentPage } from './types';

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
