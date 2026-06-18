import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCreateSkillRequest,
  parseSkill,
  parseSkillListResponse,
  parseSkillResponse,
  parseUpdateSkillRequest,
} from './skills-contract';

function baseSkillPayload() {
  return {
    id: 'skill-1',
    name: 'skill-creator',
    description: 'Create reusable skills.',
    instructions: 'Load SKILL.md then draft a new skill.',
    enabled: true,
    compatibleModes: ['thinking'],
    metadata: { requiredTools: ['web-search'], disabledTools: [] },
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
  };
}

test('parseSkill round-trips a full record', () => {
  const parsed = parseSkill(baseSkillPayload());
  assert.equal(parsed.id, 'skill-1');
  assert.equal(parsed.enabled, true);
  assert.deepEqual(parsed.requiredTools, ['web-search']);
  assert.deepEqual(parsed.disabledTools, []);
  assert.deepEqual(parsed.compatibleModes, ['thinking']);
});

test('parseSkill accepts null compatibleModes and missing tool metadata', () => {
  const parsed = parseSkill({ ...baseSkillPayload(), compatibleModes: null, metadata: {} });
  assert.equal(parsed.compatibleModes, null);
  assert.deepEqual(parsed.requiredTools, []);
});

test('parseSkill rejects unknown compatible modes', () => {
  assert.throws(() => parseSkill({ ...baseSkillPayload(), compatibleModes: ['bogus'] }), /compatibleModes/);
});

test('parseSkill enforces length limits', () => {
  const tooLong = 'x'.repeat(65);
  assert.throws(() => parseSkill({ ...baseSkillPayload(), name: tooLong }), /name/);
});

test('parseCreateSkillRequest defaults enabled to true and tool lists to empty', () => {
  const parsed = parseCreateSkillRequest({ name: 'writer', description: 'd', instructions: 'i' });
  assert.equal(parsed.enabled, true);
  assert.deepEqual(parsed.requiredTools, []);
  assert.equal(parsed.compatibleModes, null);
});

test('parseCreateSkillRequest rejects empty names', () => {
  assert.throws(() => parseCreateSkillRequest({ name: '   ', description: 'd', instructions: 'i' }), /name/);
});

test('parseUpdateSkillRequest only applies provided fields', () => {
  const parsed = parseUpdateSkillRequest({ enabled: false });
  assert.equal(parsed.enabled, false);
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.instructions, undefined);
});

test('parseUpdateSkillRequest rejects empty names', () => {
  assert.throws(() => parseUpdateSkillRequest({ name: '  ' }), /name/);
});

test('parseSkillListResponse parses an array of summaries', () => {
  const parsed = parseSkillListResponse({ skills: [baseSkillPayload()] });
  assert.equal(parsed.skills.length, 1);
  assert.equal('instructions' in parsed.skills[0], false);
  assert.equal(parsed.skills[0].id, 'skill-1');
});

test('parseSkillResponse wraps a skill record', () => {
  const parsed = parseSkillResponse({ skill: baseSkillPayload() });
  assert.equal(parsed.skill.id, 'skill-1');
});