import assert from 'node:assert/strict';
import test from 'node:test';
import { computeLatestScheduledRunAt, computeNextScheduledRunAt, matchesConversationAutomation } from './automations-schedule';
import type { AutomationRecord } from '../shared/automations-contract';

function scheduleAutomation(overrides: Partial<AutomationRecord> = {}): AutomationRecord {
  return {
    id: 'automation-1',
    name: 'daily-recap',
    description: 'Run every morning.',
    kind: 'schedule',
    trigger: { cadence: 'daily', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '09:00' },
    action: { prompt: 'Summarize', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] },
    enabled: true,
    nextRunAt: null,
    lastTriggeredAt: null,
    lastCompletedAt: null,
    lastRunStatus: 'idle',
    lastRunSummary: null,
    lastError: null,
    lastChatId: null,
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    ...overrides,
  };
}

test('computes the latest missed daily run and the next future run', () => {
  const automation = scheduleAutomation();
  const now = new Date('2026-06-19T12:00:00.000Z');
  assert.equal(computeLatestScheduledRunAt(automation, now)?.toISOString(), '2026-06-19T09:00:00.000Z');
  assert.equal(computeNextScheduledRunAt(automation, now)?.toISOString(), '2026-06-20T09:00:00.000Z');
});

test('matches conversation automations by case-insensitive phrase containment', () => {
  const automation = scheduleAutomation({
    kind: 'conversation',
    trigger: { phrases: ['meal prep', 'Macros'] },
  });
  assert.equal(matchesConversationAutomation(automation, 'Can we talk about macros for meal prep?'), true);
  assert.equal(matchesConversationAutomation(automation, 'Let us discuss workouts.'), false);
});
