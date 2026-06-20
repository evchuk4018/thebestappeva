import type { SkillRecord } from '../../shared/skills-contract';

const AUTOMATION_CREATOR_INSTRUCTIONS = [
  '# Automation Creator',
  '',
  'Help the user create or improve an app-local automation.',
  '',
  '## Workflow',
  '',
  '1. Infer as much as possible from the current conversation before asking anything.',
  '2. Identify whether the user wants a scheduled automation or a conversation-trigger automation.',
  '3. Ask for only the missing high-impact details with `ask_user` when needed.',
  '4. Gather the minimum durable fields: name, description, trigger type, prompt, linked skill if any, and tool overrides if they matter.',
  '5. For scheduled automations, capture cadence, time, timezone, optional date range, and optional jitter.',
  '6. For conversation automations, capture one or more concrete trigger phrases and describe what the assistant should additionally do.',
  '7. Draft a compact summary, confirm it, then save through the `automation` tool.',
  '',
  '## Rules',
  '',
  '- Prefer durable descriptions over one-off examples.',
  '- If a linked skill would help, inspect skills with the `skill` tool first.',
  '- Keep schedules simple unless the user asks for something more specific.',
  '- Do not invent missing linked skill names; verify them before saving.',
].join('\n');

export const automationCreatorBuiltinSkill: SkillRecord = {
  id: 'builtin:automation-creator',
  name: 'automation-creator',
  description: 'Create and refine app-local automations. Use whenever the user wants a recurring AI workflow, a scheduled run, or a conversation trigger such as “when we talk about X, also do Y.”',
  instructions: AUTOMATION_CREATOR_INSTRUCTIONS,
  source: 'builtin',
  readOnly: true,
  enabled: true,
  compatibleModes: ['thinking'],
  requiredTools: ['automation', 'skill'],
  disabledTools: [],
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
};
