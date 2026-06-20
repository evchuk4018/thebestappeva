import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './db/schema';
import { createSkillsRepository } from './db/skills-repository';
import { BuiltinSkillMutationError, BuiltinSkillNameConflictError, createSkillsService } from './skills-service';

function createTestService() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  const repository = createSkillsRepository(database);
  return { database, repository, service: createSkillsService(repository) };
}

test('lists built-in skills before user skills and supports lookup by id and name', () => {
  const { service } = createTestService();
  service.createSkill({ name: 'writer', description: 'Draft writing help.', instructions: 'Write clearly.' });

  const skills = service.listSkills();
  assert.deepEqual(skills.map((skill) => `${skill.source}:${skill.name}`), ['builtin:automation-creator', 'builtin:skill-creator', 'user:writer']);
  assert.equal(service.getSkill('builtin:skill-creator')?.readOnly, true);
  assert.equal(service.getSkill('builtin:automation-creator')?.readOnly, true);
  assert.equal(service.getSkillByName('skill-creator')?.source, 'builtin');
  assert.equal(service.getSkillByName('automation-creator')?.source, 'builtin');
  assert.equal(service.getSkillByName('writer')?.source, 'user');
});

test('rejects creating a user skill with a built-in name', () => {
  const { service } = createTestService();
  assert.throws(
    () => service.createSkill({ name: 'skill-creator', description: 'd', instructions: 'i' }),
    BuiltinSkillNameConflictError,
  );
});

test('rejects built-in mutation operations', () => {
  const { service } = createTestService();

  assert.throws(() => service.updateSkill('builtin:skill-creator', { description: 'Nope.' }), BuiltinSkillMutationError);
  assert.throws(() => service.updateSkillByName('skill-creator', { description: 'Nope.' }), BuiltinSkillMutationError);
  assert.throws(() => service.setSkillEnabled('builtin:skill-creator', false), BuiltinSkillMutationError);
  assert.throws(() => service.deleteSkill('builtin:skill-creator'), BuiltinSkillMutationError);
});

test('updates a mutable skill by skill name', () => {
  const { service } = createTestService();
  service.createSkill({ name: 'writer', description: 'd', instructions: 'i' });

  const updated = service.updateSkillByName('writer', { description: 'Revised writer.' });
  assert.equal(updated?.description, 'Revised writer.');
  assert.equal(service.getSkillByName('writer')?.description, 'Revised writer.');
});
