import { ArtifactCardSummary } from '../../../shared/ai-artifacts-contract';
import { normalizeArtifactCards } from '../../lib/ai-artifacts-storage';
import { ToolResult } from './types';

function extractCards(data: Record<string, unknown> | undefined) {
  if (!data) {
    return [] as ArtifactCardSummary[];
  }

  if ('artifactCards' in data) {
    return normalizeArtifactCards(data.artifactCards);
  }

  if ('artifactCard' in data) {
    return normalizeArtifactCards([data.artifactCard]);
  }

  return [];
}

export function mergeArtifactCards(current: ArtifactCardSummary[] | undefined, next: ArtifactCardSummary[]) {
  const merged = new Map((current ?? []).map((card) => [card.artifactId, card]));
  next.forEach((card) => merged.set(card.artifactId, card));
  return [...merged.values()];
}

export function mergeArtifactCardsFromToolResult(
  current: ArtifactCardSummary[] | undefined,
  result: ToolResult,
) {
  return mergeArtifactCards(current, extractCards(result.data));
}
