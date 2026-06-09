import assert from 'node:assert/strict';
import test from 'node:test';
import { getSelectionForSearchMatch } from './artifact-search';

test('prefers the query hit inside the matched line range', () => {
  const content = '# Intro\nThe digital divide is a persistent challenge.\nConclusion';
  const selection = getSelectionForSearchMatch(content, {
    lineStart: 2,
    lineEnd: 2,
    snippet: 'digital divide',
    matchType: 'keyword',
  }, 'digital divide');

  assert.equal(content.slice(selection.start, selection.end), 'digital divide');
});

test('falls back to the whole matched line span when the query text is unavailable', () => {
  const content = 'Alpha\nBeta line\nGamma line';
  const selection = getSelectionForSearchMatch(content, {
    lineStart: 2,
    lineEnd: 3,
    snippet: 'Beta line',
    matchType: 'hybrid',
  }, 'missing text');

  assert.equal(content.slice(selection.start, selection.end), 'Beta line\nGamma line');
});
