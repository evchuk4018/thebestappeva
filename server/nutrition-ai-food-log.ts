import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { NutritionAiFoodLogConfidence, NutritionAiFoodLogResponse } from '../shared/nutrition-ai-food-log-contract';
import type { ModelChatMessage } from '../shared/ai-runtime-contract';
import type { NutritionSearchItem } from '../shared/nutrition-contract';
import { createGeminiVisionProvider } from './ai-attachments/gemini-vision-provider';
import { isStoredImageAttachmentRecord } from './ai-attachments/record-guards';
import { getAttachmentSourcePath, readAttachmentRecord } from './ai-attachments/storage';
import { HttpError } from './http';
import { serverConfig } from './config';
import { createDeepSeekProvider } from './model-providers/deepseek';
import { nutritionRepository } from './db/nutrition-repository';

interface LoadedImage {
  attachmentId: string;
  imageBase64: string;
  mediaType: string;
  summary: string;
}

interface ModelItem {
  name: string;
  quantity: number;
  unit: 'gram' | 'serving';
  confidence: NutritionAiFoodLogConfidence;
  note: string;
}

interface ModelDraft {
  items: ModelItem[];
  followUpQuestions: string[];
  warnings: string[];
}

interface NutritionAiFoodLogDependencies {
  deepSeek?: (messages: ModelChatMessage[]) => Promise<string>;
  gemini?: (image: LoadedImage, question: string) => Promise<string>;
  loadImage?: (attachmentId: string) => Promise<LoadedImage>;
  searchItems?: (query: string, loggedAt: string, limit?: number) => NutritionSearchItem[] | Promise<NutritionSearchItem[]>;
  context?: (loggedAt: string) => unknown | Promise<unknown>;
}

const maxFollowUps = 2;
const matchThreshold = 25;

function dateKey(isoText: string) {
  return new Intl.DateTimeFormat('en-CA').format(new Date(isoText));
}

async function defaultLoadImage(attachmentId: string): Promise<LoadedImage> {
  const record = await readAttachmentRecord(attachmentId);
  if (!isStoredImageAttachmentRecord(record)) throw new HttpError(415, `"${attachmentId}" is not an image attachment.`);
  const imageBase64 = (await fs.readFile(getAttachmentSourcePath(attachmentId, record.sourceExtension))).toString('base64');
  return { attachmentId, imageBase64, mediaType: record.attachment.mediaType, summary: record.attachment.summary };
}

async function defaultDeepSeek(messages: ModelChatMessage[]) {
  if (!serverConfig.deepseekApiKey) throw new HttpError(503, 'DeepSeek food logging is unavailable because DEEPSEEK_API_KEY is not set.');
  const result = await createDeepSeekProvider().callChatStream({
    model: 'deepseek-v4-flash',
    messages,
    think: true,
    runtimeOptions: { maxOutputTokens: 1400, temperature: 0.1 },
  });
  return result.content;
}

async function defaultGemini(image: LoadedImage, question: string) {
  const result = await createGeminiVisionProvider().answerImageQuestion(image.imageBase64, question, { mediaType: image.mediaType });
  return result.text;
}

async function defaultContext(loggedAt: string) {
  const bootstrap = nutritionRepository.bootstrap(dateKey(loggedAt));
  return {
    recipes: bootstrap.recipes.map((recipe) => ({ name: recipe.name, servings: recipe.servings, totalWeightG: recipe.totalWeightG })),
    recentItems: bootstrap.recentItemNames,
    likelyItems: nutritionRepository.searchItems('', loggedAt, 12).map((item) => ({ name: item.name, type: item.itemType, serving: item.defaultServingLabel ?? `${Math.round(item.defaultAmountG)}g` })),
  };
}

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) throw new HttpError(502, 'DeepSeek returned no structured food-log JSON.');
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function confidence(value: unknown): NutritionAiFoodLogConfidence {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'low';
}

function unit(value: unknown): 'gram' | 'serving' {
  return typeof value === 'string' && /serv/i.test(value) ? 'serving' : 'gram';
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => (typeof item === 'string' && item.trim() ? [item.trim()] : [])) : [];
}

function parseModelDraft(text: string): ModelDraft {
  const payload = extractJson(text);
  const items = Array.isArray(payload.items) ? payload.items.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const quantity = Number(item.quantity);
    if (!name || !Number.isFinite(quantity) || quantity <= 0) return [];
    return [{ name, quantity, unit: unit(item.unit), confidence: confidence(item.confidence), note: typeof item.note === 'string' ? item.note.trim() : '' }];
  }) : [];
  return { items, followUpQuestions: stringList(payload.followUpQuestions).slice(0, maxFollowUps), warnings: stringList(payload.warnings) };
}

function buildMessages(image: LoadedImage, context: unknown, followUps: Array<{ question: string; answer: string }>): ModelChatMessage[] {
  return [
    { role: 'system', content: 'You turn meal photo evidence into nutrition diary draft JSON. Return JSON only: {"items":[{"name":"food or recipe name","quantity":100,"unit":"gram","confidence":"high|medium|low","note":"short evidence"}],"followUpQuestions":["optional visual question"],"warnings":["optional warning"]}. Use saved recipe names when likely. Ask follow-up questions only when the image summary is insufficient.' },
    { role: 'user', content: JSON.stringify({ imageSummary: image.summary, nutritionContext: context, geminiFollowUps: followUps }) },
  ];
}

async function matchItems(items: ModelItem[], loggedAt: string, searchItems: NonNullable<NutritionAiFoodLogDependencies['searchItems']>) {
  return Promise.all(items.map(async (item, index) => {
    const candidates = await searchItems(item.name, loggedAt, 5);
    const matchedItem = candidates[0]?.score >= matchThreshold ? candidates[0] : null;
    return {
      id: `draft_${index + 1}_${randomUUID().slice(0, 8)}`,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      confidence: item.confidence,
      needsReview: !matchedItem || item.confidence !== 'high' || matchedItem.score < 80,
      matchedItem,
      candidates,
    };
  }));
}

export async function analyzeNutritionAiFoodLog(attachmentId: string, loggedAt: string, deps: NutritionAiFoodLogDependencies = {}): Promise<NutritionAiFoodLogResponse> {
  const loadImage = deps.loadImage ?? defaultLoadImage;
  const deepSeek = deps.deepSeek ?? defaultDeepSeek;
  const gemini = deps.gemini ?? defaultGemini;
  const searchItems = deps.searchItems ?? ((query, iso, limit) => nutritionRepository.searchItems(query, iso, limit));
  const context = deps.context ?? defaultContext;
  const image = await loadImage(attachmentId);
  const trace: NutritionAiFoodLogResponse['trace'] = [{ provider: 'deepseek', action: 'summary', detail: 'Prepared image summary and nutrition context.' }];

  let followUps: Array<{ question: string; answer: string }> = [];
  let draft = parseModelDraft(await deepSeek(buildMessages(image, await context(loggedAt), followUps)));
  if (draft.followUpQuestions.length) {
    followUps = await Promise.all(draft.followUpQuestions.slice(0, maxFollowUps).map(async (question) => {
      const answer = await gemini(image, question);
      trace.push({ provider: 'gemini', action: 'follow-up', detail: question });
      return { question, answer };
    }));
    draft = parseModelDraft(await deepSeek(buildMessages(image, await context(loggedAt), followUps)));
  }

  const items = await matchItems(draft.items, loggedAt, searchItems);
  const warnings = [...draft.warnings, ...items.filter((item) => !item.matchedItem).map((item) => `No local food or recipe match found for "${item.name}".`)];
  trace.push({ provider: 'nutrition', action: 'match', detail: `Matched ${items.filter((item) => item.matchedItem).length} of ${items.length} draft item${items.length === 1 ? '' : 's'}.` });
  return { attachmentId, summary: image.summary, items, warnings: items.length ? warnings : ['No loggable foods were detected.'], trace };
}
