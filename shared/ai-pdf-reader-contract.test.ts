import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAiPdfPagesPayload } from './ai-pdf-reader-contract';

const attachment = {
  id: 'pdf-1',
  kind: 'document',
  createdAt: '2026-06-08T00:00:00.000Z',
  fileName: 'audit.pdf',
  mediaType: 'application/pdf',
  fileSize: 100,
  parser: 'docling',
  title: 'Audit',
  textChars: 20,
  chunkCount: 2,
  warningCount: 0,
  pageCount: 2,
  pdfReaderMode: 'tool',
  outline: [],
  warnings: [],
  stats: { pageCount: 2, sheetCount: null },
  previewText: 'Preview',
};

test('parses a batch PDF pages payload', () => {
  const payload = parseAiPdfPagesPayload({
    attachment,
    pageCount: 2,
    pages: [
      { markdown: '# One', pageNumber: 1, text: 'One' },
      { markdown: '# Two', pageNumber: 2, text: 'Two' },
    ],
  });

  assert.equal(payload.attachment.id, 'pdf-1');
  assert.equal(payload.pageCount, 2);
  assert.deepEqual(payload.pages.map((page) => page.pageNumber), [1, 2]);
});

test('rejects malformed batch page arrays', () => {
  assert.throws(
    () => parseAiPdfPagesPayload({ attachment, pageCount: 2, pages: {} }),
    /PDF pages payload.pages. Expected an array/,
  );
});
