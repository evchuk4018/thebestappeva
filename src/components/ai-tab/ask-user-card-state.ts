export function normalizeHighlightedChoice(choiceCount: number, highlightedChoice: number | null) {
  if (choiceCount < 1) {
    return null;
  }

  if (highlightedChoice == null || highlightedChoice < 0 || highlightedChoice >= choiceCount) {
    return 0;
  }

  return highlightedChoice;
}

export function getHighlightedChoiceForKey(choiceCount: number, highlightedChoice: number | null, key: string) {
  const normalized = normalizeHighlightedChoice(choiceCount, highlightedChoice);
  if (choiceCount < 1 || normalized == null) {
    return null;
  }

  if (/^[1-6]$/.test(key)) {
    const nextChoice = Number(key) - 1;
    return nextChoice < choiceCount ? nextChoice : normalized;
  }

  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return (normalized + 1) % choiceCount;
  }

  if (key === 'ArrowUp' || key === 'ArrowLeft') {
    return (normalized - 1 + choiceCount) % choiceCount;
  }

  return normalized;
}
