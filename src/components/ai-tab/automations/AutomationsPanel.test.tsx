import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AutomationsPanel } from './AutomationsPanel';
import type { AutomationSummary } from '../../../../shared/automations-contract';
import type { SkillSummary } from '../../../../shared/skills-contract';

const skills: SkillSummary[] = [];

function automation(overrides: Partial<AutomationSummary>): AutomationSummary {
  return {
    id: 'automation-1',
    name: 'daily-recap',
    description: 'Run every morning.',
    kind: 'schedule',
    trigger: { cadence: 'daily', timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '09:00' },
    action: { prompt: 'Summarize', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] },
    enabled: true,
    nextRunAt: '2026-06-20T09:00:00.000Z',
    lastTriggeredAt: null,
    lastCompletedAt: null,
    lastRunStatus: 'idle',
    lastRunSummary: null,
    lastError: null,
    lastChatId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

test('renders automation cards with kind and schedule metadata', () => {
  const html = renderToStaticMarkup(
    <AutomationsPanel
      automations={[automation({ action: { prompt: 'Summarize', linkedSkillId: 'skill-1', linkedSkillName: 'writer', requiredTools: [], disabledTools: [] } })]}
      loading={false}
      error={null}
      skills={skills}
      onCreate={async () => ({})}
      onUpdate={async () => ({})}
      onToggle={async () => ({})}
      onDelete={async () => {}}
    />,
  );
  assert.match(html, /Automation workspace/);
  assert.match(html, /schedule/);
  assert.match(html, /skill: writer/);
});
