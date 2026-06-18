import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createSkillsRepository } from './skills-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  return { database, repository: createSkillsRepository(database) };
}

test('creates skills schema tables and indexes', () => {
  const { database } = createTestRepository();
  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'skills%' ORDER BY name`).all() as Array<{ name: string }>;
  const indexes = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_skills_%' ORDER BY name`).all() as Array<{ name: string }>;
  assert.deepEqual(tables.map((entry) => entry.name), ['skills']);
  assert.deepEqual(indexes.map((entry) => entry.name), ['idx_skills_enabled', 'idx_skills_name', 'idx_skills_updated_at']);
});

test('supports skill CRUD, toggle, and lookup', () => {
  const { repository } = createTestRepository();
  assert.equal(repository.listSkills().length, 0);

  const created = repository.createSkill({
    name: 'skill-creator',
    description: 'Create reusable skills.',
    instructions: 'Load SKILL.md then draft a new skill.',
    compatibleModes: ['thinking'],
    requiredTools: ['web-search'],
    disabledTools: [],
  });
  assert.equal(created.enabled, true);
  assert.equal(created.compatibleModes?.length, 1);
  assert.equal(repository.getSkillByName('skill-creator')?.id, created.id);

  const updated = repository.updateSkill(created.id, { description: 'Create reusable skills, v2.', enabled: false });
  assert.equal(updated?.description, 'Create reusable skills, v2.');
  assert.equal(updated?.enabled, false);
  assert.equal(repository.listEnabledSkills().length, 0);

  const toggled = repository.setSkillEnabled(created.id, true);
  assert.equal(toggled?.enabled, true);

  const summaryList = repository.listSkillSummaries();
  assert.equal(summaryList.length, 1);
  assert.equal('instructions' in summaryList[0], false);

  const removed = repository.deleteSkill(created.id);
  assert.equal(removed, true);
  assert.equal(repository.listSkills().length, 0);
  assert.equal(repository.getSkill(created.id), null);
});

test('rejects duplicate skill names with a unique constraint error', () => {
  const { repository } = createTestRepository();
  repository.createSkill({ name: 'writer', description: 'd', instructions: 'i' });
  assert.throws(() => repository.createSkill({ name: 'writer', description: 'd2', instructions: 'i2' }), /UNIQUE constraint/i);
});

test('treats null compatible modes and undefined tool lists as defaults', () => {
  const { repository } = createTestRepository();
  const created = repository.createSkill({ name: 'generic', description: 'd', instructions: 'i' });
  assert.equal(created.compatibleModes, null);
  assert.deepEqual(created.requiredTools, []);
  assert.deepEqual(created.disabledTools, []);
});

test('returns null when updating or toggling a missing skill', () => {
  const { repository } = createTestRepository();
  assert.equal(repository.updateSkill('missing', { name: 'x' }), null);
  assert.equal(repository.setSkillEnabled('missing', true), null);
});