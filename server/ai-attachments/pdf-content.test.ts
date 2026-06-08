import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyPdfReaderMode, findPdfPage, searchPdfPages } from './pdf-content';

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
