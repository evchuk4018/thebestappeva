import { NutritionSearchItem } from './nutrition-contract';

export type NutritionAiFoodLogConfidence = 'high' | 'medium' | 'low';

export interface NutritionAiFoodLogRequest {
  attachmentId: string;
  loggedAt: string;
}

export interface NutritionAiFoodLogTraceStep {
  provider: 'deepseek' | 'gemini' | 'nutrition';
  action: string;
  detail: string;
}

export interface NutritionAiFoodLogDraftItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'gram' | 'serving';
  note: string;
  confidence: NutritionAiFoodLogConfidence;
  needsReview: boolean;
  matchedItem: NutritionSearchItem | null;
  candidates: NutritionSearchItem[];
}

export interface NutritionAiFoodLogResponse {
  attachmentId: string;
  summary: string;
  items: NutritionAiFoodLogDraftItem[];
  warnings: string[];
  trace: NutritionAiFoodLogTraceStep[];
}

function record(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${field}. Expected a non-empty string.`);
  return value.trim();
}

function number(value: unknown, field: string, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) throw new Error(`Invalid ${field}. Expected a number >= ${minimum}.`);
  return parsed;
}

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value.map((item, index) => nonEmpty(item, `${field}[${index}]`));
}

function parseConfidence(value: unknown, field: string): NutritionAiFoodLogConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  throw new Error(`Invalid ${field}. Expected "high", "medium", or "low".`);
}

function parseTraceStep(value: unknown, field: string): NutritionAiFoodLogTraceStep {
  const item = record(value, field);
  if (item.provider !== 'deepseek' && item.provider !== 'gemini' && item.provider !== 'nutrition') {
    throw new Error(`Invalid ${field}.provider.`);
  }
  return {
    provider: item.provider,
    action: nonEmpty(item.action, `${field}.action`),
    detail: nonEmpty(item.detail, `${field}.detail`),
  };
}

function parseSearchItem(value: unknown, field: string): NutritionSearchItem {
  const item = record(value, field);
  const itemType = item.itemType === 'recipe' ? 'recipe' : item.itemType === 'food' ? 'food' : null;
  if (!itemType) throw new Error(`Invalid ${field}.itemType.`);
  const nutrition = record(item.nutrition, `${field}.nutrition`);
  return {
    id: nonEmpty(item.id, `${field}.id`),
    itemType,
    name: nonEmpty(item.name, `${field}.name`),
    brandName: typeof item.brandName === 'string' && item.brandName.trim() ? item.brandName.trim() : null,
    subtitle: nonEmpty(item.subtitle, `${field}.subtitle`),
    defaultAmountG: number(item.defaultAmountG, `${field}.defaultAmountG`),
    defaultServingId: typeof item.defaultServingId === 'string' && item.defaultServingId.trim() ? item.defaultServingId.trim() : null,
    defaultServingLabel: typeof item.defaultServingLabel === 'string' && item.defaultServingLabel.trim() ? item.defaultServingLabel.trim() : null,
    nutrition: {
      calories: number(nutrition.calories, `${field}.nutrition.calories`),
      proteinG: number(nutrition.proteinG, `${field}.nutrition.proteinG`),
      carbsG: number(nutrition.carbsG, `${field}.nutrition.carbsG`),
      fatG: number(nutrition.fatG, `${field}.nutrition.fatG`),
    },
    score: number(item.score, `${field}.score`),
  };
}

function parseDraftItem(value: unknown, field: string): NutritionAiFoodLogDraftItem {
  const item = record(value, field);
  const unit = item.unit === 'serving' ? 'serving' : item.unit === 'gram' ? 'gram' : null;
  if (!unit) throw new Error(`Invalid ${field}.unit. Expected "gram" or "serving".`);
  const candidates = Array.isArray(item.candidates) ? item.candidates.map((entry, index) => parseSearchItem(entry, `${field}.candidates[${index}]`)) : [];
  return {
    id: nonEmpty(item.id, `${field}.id`),
    name: nonEmpty(item.name, `${field}.name`),
    quantity: number(item.quantity, `${field}.quantity`, 0.01),
    unit,
    note: typeof item.note === 'string' ? item.note.trim() : '',
    confidence: parseConfidence(item.confidence, `${field}.confidence`),
    needsReview: Boolean(item.needsReview),
    matchedItem: item.matchedItem ? parseSearchItem(item.matchedItem, `${field}.matchedItem`) : null,
    candidates,
  };
}

export function parseNutritionAiFoodLogRequest(value: unknown, field = 'Nutrition AI food log request'): NutritionAiFoodLogRequest {
  const item = record(value, field);
  const loggedAt = nonEmpty(item.loggedAt, `${field}.loggedAt`);
  if (Number.isNaN(Date.parse(loggedAt))) throw new Error(`Invalid ${field}.loggedAt. Expected an ISO timestamp.`);
  return { attachmentId: nonEmpty(item.attachmentId, `${field}.attachmentId`), loggedAt };
}

export function parseNutritionAiFoodLogResponse(value: unknown, field = 'Nutrition AI food log response'): NutritionAiFoodLogResponse {
  const item = record(value, field);
  if (!Array.isArray(item.items)) throw new Error(`Invalid ${field}.items. Expected an array.`);
  const trace = Array.isArray(item.trace) ? item.trace.map((entry, index) => parseTraceStep(entry, `${field}.trace[${index}]`)) : [];
  return {
    attachmentId: nonEmpty(item.attachmentId, `${field}.attachmentId`),
    summary: nonEmpty(item.summary, `${field}.summary`),
    items: item.items.map((entry, index) => parseDraftItem(entry, `${field}.items[${index}]`)),
    warnings: Array.isArray(item.warnings) ? stringArray(item.warnings, `${field}.warnings`) : [],
    trace,
  };
}
