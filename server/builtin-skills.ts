import type { SkillRecord } from '../shared/skills-contract';

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
  '4. Ask at most one focused question per pause. Offer concrete choices first, and allow open-ended input only when it adds real value.',
  '5. Gather the minimum details needed to write a durable skill: goal, trigger phrases, expected output, examples, edge cases, required tools, disabled tools, and whether the user wants creation or revision.',
  '6. Draft the skill, show a compact summary, confirm with `ask_user`, then save with the `skill` tool.',
  '7. End by suggesting 2-3 realistic prompts the user can try manually to validate the skill.',
  '',
  '## Interview Rules',
  '',
  '- Keep the language accessible. Briefly explain jargon when the user may not know it.',
  '- Prefer progress over exhaustive intake. Only ask questions that materially change the resulting skill.',
  '- If the conversation already reveals part of the workflow, reuse that information and ask only for the missing pieces.',
  '- If the user skips a detail, make a reasonable default and state it in the draft summary.',
  '',
  '## Creating A New Skill',
  '',
  '- Choose a lowercase hyphenated name under 64 characters.',
  '- Write a concise but “pushy enough” description. Include what the skill does and when it should trigger, even when the user does not explicitly say the skill name.',
  '- Write instructions in imperative form and keep them focused on durable workflow guidance rather than one-off chat filler.',
  '- Include output format expectations when the user cares about structure.',
  '- Include required tools or disabled tools only when they genuinely matter.',
  '',
  '## Updating An Existing Skill',
  '',
  '- Use `list_skills` or `view_skill` to inspect the current skill before revising it.',
  '- Preserve the existing skill name.',
  '- Improve the description when triggering is weak, and improve the instructions when the workflow is incomplete, brittle, or unclear.',
  '- Keep what already works. Avoid rewriting the whole skill unless the user wants a broad reset.',
  '',
  '## Save Flow',
  '',
  '- Before saving, present a compact summary containing the name, description, major instruction themes, tool requirements, and 2-3 validation prompts.',
  '- Ask for confirmation with `ask_user` before persisting.',
  '- For new skills, call `create_skill`.',
  '- For existing user skills, call `update_skill` with the skill name.',
  '- Do not attempt to edit built-in read-only skills.',
  '',
  '## Scope',
  '',
  '- This app supports lightweight drafting and saving only.',
  '- Do not promise benchmark runs, packaging, eval viewers, or subagent test harnesses here.',
  '- If the user wants deeper evaluation, suggest manual validation prompts inside this app instead.',
].join('\n');

const BUILTIN_SKILLS: SkillRecord[] = [{
  id: 'builtin:skill-creator',
  name: 'skill-creator',
  description: 'Create and refine app-local reusable skills. Use whenever the user wants to make a new skill, turn a repeated workflow into a reusable instruction package, improve an existing skill, or tighten a skill description so it triggers more reliably.',
  instructions: SKILL_CREATOR_INSTRUCTIONS,
  source: 'builtin',
  readOnly: true,
  enabled: true,
  compatibleModes: ['thinking'],
  requiredTools: ['skill'],
  disabledTools: [],
  createdAt: '2026-06-19T00:00:00.000Z',
  updatedAt: '2026-06-19T00:00:00.000Z',
}];

export function listBuiltinSkills() {
  return BUILTIN_SKILLS;
}

export function getBuiltinSkill(id: string) {
  return BUILTIN_SKILLS.find((skill) => skill.id === id) ?? null;
}

export function getBuiltinSkillByName(name: string) {
  return BUILTIN_SKILLS.find((skill) => skill.name === name) ?? null;
}

export function hasBuiltinSkillName(name: string) {
  return BUILTIN_SKILLS.some((skill) => skill.name === name);
}
