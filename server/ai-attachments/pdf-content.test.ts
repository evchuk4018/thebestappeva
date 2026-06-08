import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PDF_PAGE_RANGE,
  classifyPdfReaderMode,
  findPdfPage,
  searchPdfPages,
  selectPdfPageRange,
} from './pdf-content';

const pages = Array.from({ length: 12 }, (_, index) => ({
  markdown: `Page ${index + 1}`,
  pageNumber: index + 1,
  text: index === 2 ? 'Alpha target TARGET target omega' : `Page ${index + 1} has target text.`,
}));

test('classifies one through three pages as inline', () => {
  assert.equal(classifyPdfReaderMode(1), 'inline');
  assert.equal(classifyPdfReaderMode(2), 'inline');
  assert.equal(classifyPdfReaderMode(3), 'inline');
});

test('classifies four pages and unknown counts as tool-backed', () => {
  assert.equal(classifyPdfReaderMode(4), 'tool');
  assert.equal(classifyPdfReaderMode(null), 'tool');
  assert.equal(classifyPdfReaderMode(undefined), 'tool');
});

test('searches case-insensitively and caps matches', () => {
  const matches = searchPdfPages(pages, 'TARGET', 10);
  assert.equal(matches.length, 10);
  assert.equal(matches[0].pageNumber, 1);
  assert.equal(matches[2].pageNumber, 3);
  assert.match(matches[2].snippet, /target/i);
});

test('loads a valid page and rejects out-of-range pages', () => {
  assert.equal(findPdfPage(pages, 4).text, 'Page 4 has target text.');
  assert.throws(() => findPdfPage(pages, 13), /outside this PDF's 1-12 page range/);
});

test('selects inclusive page ranges', () => {
  assert.deepEqual(selectPdfPageRange(pages, 3, 5).map((page) => page.pageNumber), [3, 4, 5]);
});

test('caps page ranges at the configured maximum', () => {
  const longPdf = Array.from({ length: 40 }, (_, index) => ({
    markdown: `Page ${index + 1}`,
    pageNumber: index + 1,
    text: `Page ${index + 1}`,
  }));
  const selected = selectPdfPageRange(longPdf, 4, 40);
  assert.equal(selected.length, MAX_PDF_PAGE_RANGE);
  assert.equal(selected[0].pageNumber, 4);
  assert.equal(selected.at(-1)?.pageNumber, 28);
});

test('rejects invalid and out-of-range page ranges', () => {
  assert.throws(() => selectPdfPageRange(pages, 0, 2), /startPage must be a positive integer/);
  assert.throws(() => selectPdfPageRange(pages, 5, 4), /endPage must be an integer/);
  assert.throws(() => selectPdfPageRange(pages, 13, 14), /outside this PDF's 1-12 page range/);
});
