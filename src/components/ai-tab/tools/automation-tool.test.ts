import assert from 'node:assert/strict';
import test from 'node:test';
import { automationTool } from './automation-tool';

function createInvocation(functionName: string, args: Record<string, unknown> = {}) {
  return { toolId: 'automation', functionName, args, createdAt: new Date().toISOString() };
}

function withMockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => handler(input, init);
  return () => { globalThis.fetch = originalFetch; };
}

test('list_automations returns automations', async () => {
  const restore = withMockFetch(() => new Response(JSON.stringify({
    automations: [{
      id: 'automation-1', name: 'Daily recap', description: 'd', kind: 'schedule', trigger: { cadence: 'daily', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '09:00' },
      action: { prompt: 'Summarize', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] }, enabled: true, nextRunAt: null, lastTriggeredAt: null, lastCompletedAt: null, lastRunStatus: 'idle', lastRunSummary: null, lastError: null, lastChatId: null, createdAt: '2026-06-19T00:00:00.000Z', updatedAt: '2026-06-19T00:00:00.000Z',
    }],
  })));
  try {
    const result = await automationTool.execute(createInvocation('list_automations'), {});
    assert.equal('deferred' in result, false);
    if ('deferred' in result) return;
    assert.equal(result.ok, true);
  } finally {
    restore();
  }
});

test('create_automation validates required fields', async () => {
  const result = await automationTool.execute(createInvocation('create_automation', { name: 'x' }), {});
  assert.equal('deferred' in result, false);
  if ('deferred' in result) return;
  assert.equal(result.ok, false);
});

test('update_automation resolves an automation by name before update', async () => {
  const restore = withMockFetch((input, init) => {
    const url = String(input);
    if (url.endsWith('/api/automations') && !init?.method) {
      return new Response(JSON.stringify({ automations: [{ id: 'automation-1', name: 'Daily recap', description: 'd', kind: 'conversation', trigger: { phrases: ['x'] }, action: { prompt: 'p', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] }, enabled: true, nextRunAt: null, lastTriggeredAt: null, lastCompletedAt: null, lastRunStatus: 'idle', lastRunSummary: null, lastError: null, lastChatId: null, createdAt: '2026-06-19T00:00:00.000Z', updatedAt: '2026-06-19T00:00:00.000Z' }] }));
    }
    return new Response(JSON.stringify({ automation: { id: 'automation-1', name: 'Daily recap', description: 'updated', kind: 'conversation', trigger: { phrases: ['x'] }, action: { prompt: 'p', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] }, enabled: true, nextRunAt: null, lastTriggeredAt: null, lastCompletedAt: null, lastRunStatus: 'idle', lastRunSummary: null, lastError: null, lastChatId: null, createdAt: '2026-06-19T00:00:00.000Z', updatedAt: '2026-06-19T00:00:00.000Z' } }));
  });
  try {
    const result = await automationTool.execute(createInvocation('update_automation', { automationName: 'Daily recap', description: 'updated' }), {});
    assert.equal('deferred' in result, false);
    if ('deferred' in result) return;
    assert.equal(result.ok, true);
  } finally {
    restore();
  }
});
