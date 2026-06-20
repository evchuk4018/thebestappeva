import type { SkillRecord } from '../../shared/skills-contract';

const SKILL_CREATOR_INSTRUCTIONS = [
  '# Skill Creator',
  '',
  'Help the user create or improve an app-local skill.',
  '',
  '## Workflow',
  '',
  '1. Start by extracting clues from the current conversation before asking anything.',
  '2. Decide whether the user wants a new skill or an update to an existing skill.',
  '3. Use `ask_user` for high-value clarifications instead of piling on freeform questions.',
  '4. Ask at most one focused question per pause.',
  '5. Gather the minimum details needed to write a durable skill: goal, trigger phrases, expected output, examples, edge cases, required tools, disabled tools, and whether the user wants creation or revision.',
  '6. Draft the skill, show a compact summary, confirm with `ask_user`, then save with the `skill` tool.',
  '7. End by suggesting 2-3 realistic prompts the user can try manually to validate the skill.',
  '',
  '## Rules',
  '',
  '- Keep the language accessible and concise.',
  '- Reuse details already present in the conversation.',
  '- Preserve existing names when updating an existing skill.',
  '- Do not attempt to edit built-in read-only skills.',
].join('\n');

export const skillCreatorBuiltinSkill: SkillRecord = {
  id: 'builtin:skill-creator',
  name: 'skill-creator',
  description: 'Create and refine app-local reusable skills. Use whenever the user wants to make a new skill, improve an existing skill, or turn a repeated workflow into reusable instructions.',
  instructions: SKILL_CREATOR_INSTRUCTIONS,
  source: 'builtin',
  readOnly: true,
  enabled: true,
  compatibleModes: ['thinking'],
  requiredTools: ['skill'],
  disabledTools: [],
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
};
