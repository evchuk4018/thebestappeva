import assert from 'node:assert/strict';
import test from 'node:test';
import type { AutomationSummary } from '../../../shared/automations-contract';
import type { SkillSummary } from '../../../shared/skills-contract';
import { filterAutomationsForWorkspaceSearch, filterSkillsForWorkspaceSearch, filterToolsForWorkspaceSearch, type SearchableTool } from './workspace-search';

function tool(overrides: Partial<SearchableTool>): SearchableTool {
  return {
    id: 'weather',
    label: 'Weather Tool',
    alias: '/weather',
    description: 'Looks up local forecasts.',
    enabled: true,
    enabledByDefault: true,
    functions: [
      {
        name: 'get_forecast',
        description: 'Fetch a forecast by city.',
        parameters: [{ name: 'city', type: 'string', description: 'Place name.', required: true }],
      },
    ],
    ...overrides,
  };
}

function skill(overrides: Partial<SkillSummary>): SkillSummary {
  return {
    id: 'skill-1',
    name: 'researcher',
    description: 'Research topics with citations.',
    source: 'user',
    readOnly: false,
    enabled: true,
    compatibleModes: ['thinking'],
    requiredTools: ['web-search'],
    disabledTools: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function automation(overrides: Partial<AutomationSummary>): AutomationSummary {
  return {
    id: 'automation-1',
    name: 'Daily research digest',
    description: 'Summarize new research.',
    kind: 'conversation',
    trigger: { phrases: ['daily brief'] },
    action: { prompt: 'Summarize', linkedSkillId: 'skill-1', linkedSkillName: 'researcher', requiredTools: ['web-search'], disabledTools: [] },
    enabled: true,
    nextRunAt: null,
    lastTriggeredAt: null,
    lastCompletedAt: null,
    lastRunStatus: 'success',
    lastRunSummary: 'Finished cleanly',
    lastError: null,
    lastChatId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

test('workspace tool search trims whitespace and matches case-insensitively', () => {
  const tools = [tool({}), tool({ id: 'python', label: 'Python Exec', alias: '/python.exec' })];
  const result = filterToolsForWorkspaceSearch(tools, '  WEATHER   tool ');
  assert.deepEqual(result.map((entry) => entry.id), ['weather']);
});

test('workspace tool search matches nested function parameters', () => {
  const result = filterToolsForWorkspaceSearch([tool({})], 'city');
  assert.equal(result.length, 1);
});

test('workspace skill search matches command names, status, and tool metadata', () => {
  const skills = [skill({}), skill({ id: 'skill-2', name: 'drafting', enabled: false, requiredTools: [] })];
  assert.deepEqual(filterSkillsForWorkspaceSearch(skills, '/researcher').map((entry) => entry.id), ['skill-1']);
  assert.deepEqual(filterSkillsForWorkspaceSearch(skills, 'disabled').map((entry) => entry.id), ['skill-2']);
  assert.deepEqual(filterSkillsForWorkspaceSearch(skills, 'web-search').map((entry) => entry.id), ['skill-1']);
});

test('workspace automation search matches trigger, skill, and run status fields', () => {
  const automations = [automation({}), automation({ id: 'automation-2', name: 'Monthly cleanup', kind: 'schedule', trigger: { cadence: 'monthly', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '09:00', dayOfMonth: 1 }, action: { prompt: 'Clean', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: ['weather'] }, lastRunStatus: 'idle', lastRunSummary: null })];
  assert.deepEqual(filterAutomationsForWorkspaceSearch(automations, 'daily brief').map((entry) => entry.id), ['automation-1']);
  assert.deepEqual(filterAutomationsForWorkspaceSearch(automations, 'monthly').map((entry) => entry.id), ['automation-2']);
  assert.deepEqual(filterAutomationsForWorkspaceSearch(automations, 'success').map((entry) => entry.id), ['automation-1']);
});

test('workspace searches return all records for an empty query', () => {
  const tools = [tool({}), tool({ id: 'date', label: 'Date Time', alias: '/date-time' })];
  const skills = [skill({}), skill({ id: 'skill-2', name: 'writer' })];
  const automations = [automation({}), automation({ id: 'automation-2', name: 'Weekly recap' })];
  assert.equal(filterToolsForWorkspaceSearch(tools, '').length, 2);
  assert.equal(filterSkillsForWorkspaceSearch(skills, '   ').length, 2);
  assert.equal(filterAutomationsForWorkspaceSearch(automations, '').length, 2);
});
