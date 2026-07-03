import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createAutomationsRepository } from './automations-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  return { database, repository: createAutomationsRepository(database) };
}

test('creates automation schema tables and indexes', () => {
  const { database } = createTestRepository();
  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'automations%' ORDER BY name`).all() as Array<{ name: string }>;
  const indexes = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_automations_%' ORDER BY name`).all() as Array<{ name: string }>;
  assert.deepEqual(tables.map((entry) => entry.name), ['automations']);
  assert.deepEqual(indexes.map((entry) => entry.name), ['idx_automations_owner_due', 'idx_automations_owner_enabled', 'idx_automations_owner_name']);
});

test('supports automation CRUD, enable toggles, and run reporting', () => {
  const { repository } = createTestRepository();
  const created = repository.createAutomation({
    name: 'daily-recap',
    description: 'Run every morning.',
    kind: 'schedule',
    trigger: { cadence: 'daily', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '09:00' },
    action: { prompt: 'Summarize', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] },
    enabled: true,
    nextRunAt: '2026-06-20T09:00:00.000Z',
  });
  assert.equal(repository.getAutomationByName('daily-recap')?.id, created.id);

  const toggled = repository.setAutomationEnabled(created.id, false, null);
  assert.equal(toggled?.enabled, false);
  assert.equal(toggled?.nextRunAt, null);

  const reported = repository.reportRun(created.id, { status: 'success', summary: 'Done.', chatId: 'chat-1' });
  assert.equal(reported?.lastRunStatus, 'success');
  assert.equal(reported?.lastChatId, 'chat-1');

  const updated = repository.updateAutomation(created.id, { description: 'Updated.' });
  assert.equal(updated?.description, 'Updated.');
  assert.equal(repository.deleteAutomation(created.id), true);
});

test('scopes automations by owner while allowing duplicate names across owners', () => {
  const { database, repository } = createTestRepository();
  const otherRepository = createAutomationsRepository(database, 'other-owner');
  const canonical = repository.createAutomation({
    name: 'daily-recap',
    description: 'Mine',
    kind: 'conversation',
    trigger: { phrases: ['mine'] },
    action: { prompt: 'Mine', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] },
    enabled: true,
    nextRunAt: null,
  });
  const other = otherRepository.createAutomation({
    name: 'daily-recap',
    description: 'Other',
    kind: 'conversation',
    trigger: { phrases: ['other'] },
    action: { prompt: 'Other', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] },
    enabled: true,
    nextRunAt: null,
  });

  assert.equal(repository.getAutomation(other.id), null);
  assert.equal(repository.updateAutomation(other.id, { description: 'Nope' }), null);
  assert.equal(repository.deleteAutomation(other.id), false);
  assert.equal(otherRepository.getAutomation(other.id)?.description, 'Other');
  assert.equal(repository.getAutomation(canonical.id)?.description, 'Mine');
});
