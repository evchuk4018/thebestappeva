import type { SkillSummary } from '../../../../shared/skills-contract';

const MAX_SKILL_SUGGESTIONS = 8;

export interface SkillToken {
  start: number;
  end: number;
  prefix: string;
}

export function parseSkillToken(input: string, caretIndex: number = input.length): SkillToken | null {
  if (caretIndex < 0 || caretIndex > input.length) return null;
  const before = input.slice(0, caretIndex);
  const slashIndex = before.lastIndexOf('/');
  if (slashIndex < 0) return null;
  if (slashIndex > 0 && !/\s/.test(input[slashIndex - 1])) return null;
  const after = input.slice(slashIndex);
  const endOffset = after.search(/\s/);
  const tokenEnd = endOffset === -1 ? caretIndex : Math.min(slashIndex + endOffset, caretIndex);
  const prefix = input.slice(slashIndex + 1, tokenEnd);
  if (prefix.includes('/') || prefix.includes('\n')) return null;
  return { start: slashIndex, end: tokenEnd, prefix };
}

export function filterSkillsForPrefix(skills: SkillSummary[], prefix: string): SkillSummary[] {
  const normalized = prefix.trim().toLowerCase();
  return skills
    .filter((skill) => skill.enabled)
    .filter((skill) => (normalized ? skill.name.toLowerCase().startsWith(normalized) : true))
    .slice(0, MAX_SKILL_SUGGESTIONS);
}

export function getHighlightedSkillForKey(choiceCount: number, highlighted: number | null, key: string): number | null {
  if (choiceCount < 1) return null;
  const normalized = highlighted == null || highlighted < 0 || highlighted >= choiceCount ? 0 : highlighted;
  if (key === 'ArrowDown' || key === 'ArrowRight') return (normalized + 1) % choiceCount;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return (normalized - 1 + choiceCount) % choiceCount;
  return normalized;
}