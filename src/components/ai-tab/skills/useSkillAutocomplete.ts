import { useCallback, useMemo, useState } from 'react';
import type { SkillSummary } from '../../../../shared/skills-contract';
import { filterSkillsForPrefix, getHighlightedSkillForKey, parseSkillToken } from './skill-autocomplete-state';

export interface SkillAutocompleteResult {
  isOpen: boolean;
  suggestions: SkillSummary[];
  highlighted: number | null;
  update: (input: string, caret: number) => void;
  reset: () => void;
  handleKeyDown: (event: { key: string; preventDefault: () => void }) => boolean;
  select: (skill: SkillSummary) => void;
}

function buildReplacement(input: string, start: number, end: number, skillName: string) {
  return `${input.slice(0, start)}/${skillName} ${input.slice(end)}`;
}

export function useSkillAutocomplete(
  skills: SkillSummary[],
  onInsert: (nextInput: string, nextCaret: number) => void,
): SkillAutocompleteResult {
  const [input, setInput] = useState('');
  const [token, setToken] = useState<{ start: number; end: number; prefix: string } | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const suggestions = useMemo(
    () => (token ? filterSkillsForPrefix(skills, token.prefix) : []),
    [skills, token],
  );
  const isOpen = Boolean(token) && suggestions.length > 0;

  const update = useCallback((nextInput: string, caret: number) => {
    setInput(nextInput);
    const nextToken = parseSkillToken(nextInput, caret);
    setToken(nextToken);
    setHighlighted(nextToken ? 0 : null);
  }, []);

  const reset = useCallback(() => {
    setToken(null);
    setHighlighted(null);
  }, []);

  const applySelection = useCallback(
    (skill: SkillSummary) => {
      if (!token) return;
      const next = buildReplacement(input, token.start, token.end, skill.name);
      const nextCaret = token.start + 1 + skill.name.length + 1;
      onInsert(next, nextCaret);
      reset();
    },
    [input, onInsert, reset, token],
  );

  const handleKeyDown = useCallback(
    (event: { key: string; preventDefault: () => void }): boolean => {
      if (!isOpen || !token) return false;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlighted(getHighlightedSkillForKey(suggestions.length, highlighted, event.key));
        return true;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const target = highlighted == null ? suggestions[0] : suggestions[highlighted];
        if (target) applySelection(target);
        return true;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        reset();
        return true;
      }
      return false;
    },
    [applySelection, highlighted, isOpen, reset, suggestions, token],
  );

  return { isOpen, suggestions, highlighted, update, reset, handleKeyDown, select: applySelection };
}