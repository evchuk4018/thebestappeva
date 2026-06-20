import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isScheduleAutomation,
  parseAutomation,
  parseAutomationListResponse,
  parseClaimDueAutomationsResponse,
  parseCreateAutomationRequest,
  parseReportAutomationRunRequest,
  parseUpdateAutomationRequest,
} from './automations-contract';

function schedulePayload() {
  return {
    id: 'automation-1',
    name: 'Daily recap',
    description: 'Run every day.',
    kind: 'schedule',
    trigger: { cadence: 'daily', timezone: 'America/New_York', startDate: null, endDate: null, jitterMinutes: 10, timeOfDay: '09:30' },
    action: { prompt: 'Summarize today.', linkedSkillId: 'skill-1', linkedSkillName: 'writer', requiredTools: ['web-search'], disabledTools: [] },
    enabled: true,
    nextRunAt: '2026-06-20T13:35:00.000Z',
    lastTriggeredAt: null,
    lastCompletedAt: null,
    lastRunStatus: 'idle',
    lastRunSummary: null,
    lastError: null,
    lastChatId: null,
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
  };
}

test('parseAutomation handles a schedule automation', () => {
  const parsed = parseAutomation(schedulePayload());
  assert.equal(parsed.kind, 'schedule');
  assert.equal(isScheduleAutomation(parsed) ? parsed.trigger.cadence : '', 'daily');
  assert.equal(parsed.action.linkedSkillName, 'writer');
});

test('parseAutomation handles a conversation automation', () => {
  const parsed = parseAutomation({
    ...schedulePayload(),
    kind: 'conversation',
    trigger: { phrases: ['nutrition', 'macros'] },
    nextRunAt: null,
  });
  assert.deepEqual(parsed.trigger, { phrases: ['nutrition', 'macros'] });
});

test('parseCreateAutomationRequest defaults enabled and tool arrays', () => {
  const parsed = parseCreateAutomationRequest({
    name: 'Talk trigger',
    description: 'Help in chat.',
    kind: 'conversation',
    trigger: { phrases: ['workout'] },
    action: { prompt: 'Also ask about recovery.', linkedSkillId: null },
  });
  assert.equal(parsed.enabled, true);
  assert.deepEqual(parsed.action.requiredTools, []);
});

test('parseCreateAutomationRequest rejects invalid schedule fields', () => {
  assert.throws(() => parseCreateAutomationRequest({
    name: 'Bad',
    description: 'Bad',
    kind: 'schedule',
    trigger: { cadence: 'weekly', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '25:00', weekdays: ['mon'] },
    action: { prompt: 'x', linkedSkillId: null },
  }), /timeOfDay/);
});

test('parseUpdateAutomationRequest supports partial updates', () => {
  const parsed = parseUpdateAutomationRequest({ enabled: false });
  assert.equal(parsed.enabled, false);
  assert.equal(parsed.name, undefined);
});

test('parseAutomationListResponse parses lists', () => {
  const parsed = parseAutomationListResponse({ automations: [schedulePayload()] });
  assert.equal(parsed.automations.length, 1);
});

test('parseClaimDueAutomationsResponse parses claimed runs', () => {
  const parsed = parseClaimDueAutomationsResponse({ runs: [{ automation: schedulePayload(), claimedRunAt: '2026-06-20T13:35:00.000Z' }] });
  assert.equal(parsed.runs[0]?.claimedRunAt, '2026-06-20T13:35:00.000Z');
});

test('parseReportAutomationRunRequest parses success and error payloads', () => {
  const parsed = parseReportAutomationRunRequest({ status: 'error', error: 'Model unavailable.', chatId: null });
  assert.equal(parsed.status, 'error');
  assert.equal(parsed.error, 'Model unavailable.');
});
