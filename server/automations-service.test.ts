import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './db/schema';
import { createAutomationsRepository } from './db/automations-repository';
import { createAutomationsService, LinkedSkillNotFoundError } from './automations-service';
import { createSkillsRepository } from './db/skills-repository';
import { createSkillsService } from './skills-service';

function createTestService() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  const automations = createAutomationsRepository(database);
  const skills = createSkillsService(createSkillsRepository(database));
  return { service: createAutomationsService(automations, skills), skills };
}

test('resolves linked skills by name when creating automations', async () => {
  const { service, skills } = createTestService();
  const skill = await skills.createSkill({ name: 'writer', description: 'Draft', instructions: 'Write clearly.' });
  const automation = await service.createAutomation({
    name: 'daily-recap',
    description: 'Run every morning.',
    kind: 'conversation',
    trigger: { phrases: ['planning'] },
    action: { prompt: 'Also summarize.', linkedSkillId: null, linkedSkillName: 'writer', requiredTools: [], disabledTools: [] },
  });
  assert.equal(automation.action.linkedSkillId, skill.id);
  assert.equal(automation.action.linkedSkillName, 'writer');
});

test('rejects missing linked skills', async () => {
  const { service } = createTestService();
  await assert.rejects(() => service.createAutomation({
    name: 'daily-recap',
    description: 'Run every morning.',
    kind: 'conversation',
    trigger: { phrases: ['planning'] },
    action: { prompt: 'Also summarize.', linkedSkillId: null, linkedSkillName: 'missing-skill', requiredTools: [], disabledTools: [] },
  }), LinkedSkillNotFoundError);
});
