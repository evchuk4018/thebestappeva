import assert from 'node:assert/strict';
import test from 'node:test';
import { getHighlightedChoiceForKey, normalizeHighlightedChoice } from './ask-user-card-state';

test('normalizes the highlighted choice into range', () => {
  assert.equal(normalizeHighlightedChoice(3, null), 0);
  assert.equal(normalizeHighlightedChoice(3, -1), 0);
  assert.equal(normalizeHighlightedChoice(3, 4), 0);
  assert.equal(normalizeHighlightedChoice(3, 2), 2);
});

test('updates the highlighted choice from number and arrow keys', () => {
  assert.equal(getHighlightedChoiceForKey(4, 0, '3'), 2);
  assert.equal(getHighlightedChoiceForKey(4, 1, 'ArrowDown'), 2);
  assert.equal(getHighlightedChoiceForKey(4, 0, 'ArrowUp'), 3);
  assert.equal(getHighlightedChoiceForKey(2, 0, '6'), 0);
});
