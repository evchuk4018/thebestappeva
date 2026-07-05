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

test('lists built-in skills before user skills and supports lookup by id and name', async () => {
  const { service } = createTestService();
  await service.createSkill({ name: 'writer', description: 'Draft writing help.', instructions: 'Write clearly.' });

  const skills = await service.listSkills();
  assert.deepEqual(skills.map((skill) => `${skill.source}:${skill.name}`), ['builtin:automation-creator', 'builtin:skill-creator', 'user:writer']);
  assert.equal((await service.getSkill('builtin:skill-creator'))?.readOnly, true);
  assert.equal((await service.getSkill('builtin:automation-creator'))?.readOnly, true);
  assert.equal((await service.getSkillByName('skill-creator'))?.source, 'builtin');
  assert.equal((await service.getSkillByName('automation-creator'))?.source, 'builtin');
  assert.equal((await service.getSkillByName('writer'))?.source, 'user');
});

test('rejects creating a user skill with a built-in name', async () => {
  const { service } = createTestService();
  await assert.rejects(
    () => service.createSkill({ name: 'skill-creator', description: 'd', instructions: 'i' }),
    BuiltinSkillNameConflictError,
  );
});

test('rejects built-in mutation operations', async () => {
  const { service } = createTestService();

  await assert.rejects(() => service.updateSkill('builtin:skill-creator', { description: 'Nope.' }), BuiltinSkillMutationError);
  await assert.rejects(() => service.updateSkillByName('skill-creator', { description: 'Nope.' }), BuiltinSkillMutationError);
  await assert.rejects(() => service.setSkillEnabled('builtin:skill-creator', false), BuiltinSkillMutationError);
  await assert.rejects(() => service.deleteSkill('builtin:skill-creator'), BuiltinSkillMutationError);
});

test('updates a mutable skill by skill name', async () => {
  const { service } = createTestService();
  await service.createSkill({ name: 'writer', description: 'd', instructions: 'i' });

  const updated = await service.updateSkillByName('writer', { description: 'Revised writer.' });
  assert.equal(updated?.description, 'Revised writer.');
  assert.equal((await service.getSkillByName('writer'))?.description, 'Revised writer.');
});
