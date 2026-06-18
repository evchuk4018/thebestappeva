import assert from 'node:assert/strict';
import test from 'node:test';
import { filterSkillsForPrefix, getHighlightedSkillForKey, parseSkillToken } from './skill-autocomplete-state';
import type { SkillSummary } from '../../../../shared/skills-contract';

function skill(name: string, enabled = true): SkillSummary {
  return {
    id: name,
    name,
    description: 'd',
    enabled,
    compatibleModes: null,
    requiredTools: [],
    disabledTools: [],
    createdAt: '',
    updatedAt: '',
  };
}

test('parseSkillToken finds a slash token at the start of the input', () => {
  assert.deepEqual(parseSkillToken('/skill-c', 8), { start: 0, end: 8, prefix: 'skill-c' });
});

test('parseSkillToken finds a slash token after whitespace', () => {
  assert.deepEqual(parseSkillToken('hello /ski', 10), { start: 6, end: 10, prefix: 'ski' });
});

test('parseSkillToken returns null when slash is not preceded by whitespace', () => {
  assert.equal(parseSkillToken('a/b', 3), null);
});

test('parseSkillToken returns null when no slash is present', () => {
  assert.equal(parseSkillToken('hello', 5), null);
});

test('parseSkillToken stops the token at the first whitespace after the slash', () => {
  assert.deepEqual(parseSkillToken('/skill-c now', 12), { start: 0, end: 8, prefix: 'skill-c' });
});

test('filterSkillsForPrefix only returns enabled skills matching the prefix', () => {
  const skills = [skill('skill-creator'), skill('writer'), skill('disabled', false)];
  const result = filterSkillsForPrefix(skills, 'skill');
  assert.deepEqual(result.map((entry) => entry.name), ['skill-creator']);
});

test('filterSkillsForPrefix with empty prefix returns all enabled skills up to the cap', () => {
  const skills = [skill('skill-creator'), skill('writer')];
  assert.equal(filterSkillsForPrefix(skills, '').length, 2);
});

test('getHighlightedSkillForKey moves the highlight with arrow keys', () => {
  assert.equal(getHighlightedSkillForKey(3, null, 'ArrowDown'), 1);
  assert.equal(getHighlightedSkillForKey(3, 1, 'ArrowDown'), 2);
  assert.equal(getHighlightedSkillForKey(3, 2, 'ArrowDown'), 0);
  assert.equal(getHighlightedSkillForKey(3, 0, 'ArrowUp'), 2);
  assert.equal(getHighlightedSkillForKey(0, null, 'ArrowDown'), null);
});