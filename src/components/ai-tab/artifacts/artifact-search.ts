import type { ArtifactSearchMatch } from '../../../../shared/ai-artifacts-contract';

export interface SearchSelectionRange {
  start: number;
  end: number;
}

function findLineStarts(content: string) {
  const starts = [0];

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\n') {
      starts.push(index + 1);
    }
  }

  return starts;
}

function trimTrailingLineBreaks(content: string, end: number, start: number) {
  let nextEnd = end;

  while (nextEnd > start && (content[nextEnd - 1] === '\n' || content[nextEnd - 1] === '\r')) {
    nextEnd -= 1;
  }

  return nextEnd;
}

function findCaseInsensitiveOffset(content: string, query: string, start: number, end: number) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  const haystack = content.slice(start, end).toLocaleLowerCase();
  const matchIndex = haystack.indexOf(normalizedQuery);
  return matchIndex === -1 ? null : start + matchIndex;
}

export function getSelectionForSearchMatch(content: string, match: ArtifactSearchMatch, query: string): SearchSelectionRange {
  const lineStarts = findLineStarts(content);
  const start = lineStarts[Math.max(0, match.lineStart - 1)] ?? 0;
  const nextLineStart = lineStarts[match.lineEnd] ?? content.length;
  const end = trimTrailingLineBreaks(content, nextLineStart, start);
  const queryOffset = findCaseInsensitiveOffset(content, query, start, end);

  if (queryOffset !== null) {
    return { start: queryOffset, end: queryOffset + query.trim().length };
  }

  return { start, end };
}
