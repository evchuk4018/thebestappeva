import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SkillsPanel } from './SkillsPanel';
import type { SkillSummary } from '../../../../shared/skills-contract';

function skill(overrides: Partial<SkillSummary>): SkillSummary {
  return {
    id: 'skill-1',
    name: 'skill-creator',
    description: 'Create reusable skills.',
    source: 'builtin',
    readOnly: true,
    enabled: true,
    compatibleModes: ['thinking'],
    requiredTools: ['skill'],
    disabledTools: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function render(skills: SkillSummary[]) {
  return renderToStaticMarkup(
    <SkillsPanel
      skills={skills}
      loading={false}
      error={null}
      onCreate={async () => ({})}
      onUpdate={async () => ({})}
      onToggle={async () => ({})}
      onDelete={async () => {}}
    />,
  );
}

test('renders built-in skills as read-only with a badge', () => {
  const html = render([skill({})]);
  assert.match(html, /Built-in/);
  assert.match(html, /Read only/);
  assert.doesNotMatch(html, /title="Edit skill"/);
  assert.doesNotMatch(html, /aria-pressed=/);
});

test('renders edit controls for mutable user skills', () => {
  const html = render([skill({
    id: 'skill-2',
    name: 'writer',
    source: 'user',
    readOnly: false,
    requiredTools: [],
  })]);
  assert.match(html, /title="Edit skill"/);
  assert.match(html, /title="Delete skill"/);
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /Read only/);
});
