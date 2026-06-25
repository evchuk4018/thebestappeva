import type { NutritionSearchItem } from '../../shared/nutrition-contract';

interface UsageRow {
  item_type: string;
  item_id: string;
  use_count: number;
  last_used_at: string;
  morning_count: number;
  midday_count: number;
  evening_count: number;
  latenight_count: number;
}

export interface SearchCandidate extends Omit<NutritionSearchItem, 'score'> {}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function textScore(query: string, candidate: string) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q) return 0;
  if (c === q) return 120;
  if (c.startsWith(q)) return 95;
  if (c.includes(q)) return 78;
  const queryTerms = q.split(' ');
  const candidateTerms = c.split(' ');
  const hits = queryTerms.reduce((sum, term) => sum + (candidateTerms.some((part) => part.startsWith(term)) ? 12 : candidateTerms.includes(term) ? 8 : 0), 0);
  return hits - Math.max(0, candidateTerms.length - queryTerms.length);
}

function daysSince(isoText: string, referenceIso: string) {
  return Math.max(0, (new Date(referenceIso).getTime() - new Date(isoText).getTime()) / 86400000);
}

export function rankSearchItems(candidates: SearchCandidate[], usageRows: UsageRow[], query: string, loggedAt: string) {
  const slot = new Date(loggedAt).getHours() < 5 ? 'latenight_count' : new Date(loggedAt).getHours() < 11 ? 'morning_count' : new Date(loggedAt).getHours() < 16 ? 'midday_count' : new Date(loggedAt).getHours() < 22 ? 'evening_count' : 'latenight_count';
  const usageMap = new Map(usageRows.map((row) => [`${row.item_type}:${row.item_id}`, row]));
  return candidates
    .map((candidate) => {
      const usage = usageMap.get(`${candidate.itemType}:${candidate.id}`);
      const base = textScore(query, `${candidate.name} ${candidate.brandName ?? ''}`);
      const recency = usage ? Math.max(0, 28 - daysSince(usage.last_used_at, loggedAt)) : 0;
      const frequency = usage ? Math.min(24, Number(usage.use_count) * 2.2) : 0;
      const slotAffinity = usage ? Math.min(18, Number(usage[slot]) * 3) : 0;
      return { ...candidate, score: Number((base + recency + frequency + slotAffinity).toFixed(2)) };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));
}
