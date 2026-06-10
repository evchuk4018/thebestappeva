import assert from 'node:assert/strict';
import test from 'node:test';
import { AiAttachmentReference } from '../types';
import { createPdfReaderTool } from './pdf-reader-tool';

const attachment: AiAttachmentReference = {
  id: 'pdf-1',
  fileName: 'audit.pdf',
  mediaType: 'application/pdf',
  fileSize: 100,
  parser: 'docling',
  title: 'Audit',
  textChars: 20,
  chunkCount: 2,
  warningCount: 0,
  pageCount: 12,
  pdfReaderMode: 'tool',
};

const parsedAttachment = {
  ...attachment,
  createdAt: '2026-06-08T00:00:00.000Z',
  outline: [],
  warnings: [],
  stats: { pageCount: 12, sheetCount: null },
  previewText: 'Preview',
};

async function executeReadPages(args: Record<string, unknown>) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  let requestedUrl = '';

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://local.test' } },
  });
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
      attachment: parsedAttachment,
      pageCount: 12,
      pages: [{ markdown: '# One', pageNumber: 1, text: 'One' }],
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const tool = createPdfReaderTool([attachment]);
    const result = await tool.execute({
      toolId: 'pdf-reader',
      functionName: 'read_pdf_pages',
      args: { attachmentId: attachment.id, ...args },
      createdAt: '2026-06-08T00:00:00.000Z',
    }, {});
    return { requestedUrl, result };
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  }
}

test('read_pdf_pages defaults to the server-managed whole-document range', async () => {
  const { requestedUrl, result } = await executeReadPages({});
  const url = new URL(requestedUrl);
  assert.equal(url.search, '');
  assert(!('deferred' in result));
  assert.equal(result.ok, true);
  assert.match(result.summary, /pages 1-1 of 12/);
});

test('read_pdf_pages forwards explicit page bounds', async () => {
  const { requestedUrl } = await executeReadPages({ startPage: 4, endPage: 9 });
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get('startPage'), '4');
  assert.equal(url.searchParams.get('endPage'), '9');
});

test('read_pdf_pages rejects reversed page bounds', async () => {
  const tool = createPdfReaderTool([attachment]);
  await assert.rejects(
    () => tool.execute({
      toolId: 'pdf-reader',
      functionName: 'read_pdf_pages',
      args: { attachmentId: attachment.id, startPage: 8, endPage: 4 },
      createdAt: '2026-06-08T00:00:00.000Z',
    }, {}),
    /endPage.*greater than or equal/,
  );
});
