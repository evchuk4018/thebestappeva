import assert from 'node:assert/strict';
import test from 'node:test';
import { createThinkingDeltaParser, normalizeThinkingOutput } from './thinking-parser';

test('normalizeThinkingOutput strips think tags from content and preserves hidden thinking', () => {
  const normalized = normalizeThinkingOutput('<think>Plan first</think>Final answer');
  assert.equal(normalized.thinking, 'Plan first');
  assert.equal(normalized.content, 'Final answer');
});

test('stream parser handles split think tags across chunks', () => {
  const parser = createThinkingDeltaParser();
  const first = parser.push('<thi');
  const second = parser.push('nk>Plan</think>Done');
  const final = parser.finish();

  assert.equal(first.content, '');
  assert.equal(first.thinking, '');
  assert.equal(second.thinking, 'Plan');
  assert.equal(second.content, 'Done');
  assert.equal(final.content, '');
  assert.equal(final.thinking, '');
});
