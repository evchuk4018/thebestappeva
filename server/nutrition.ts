import type { Request, Response } from 'express';
import { parseNutritionDiaryEntryInput, parseNutritionFoodInput, parseNutritionGoalsInput, parseNutritionHistoryQuery, parseNutritionRecipeInput } from '../shared/nutrition-contract';
import { parseNutritionAiFoodLogRequest } from '../shared/nutrition-ai-food-log-contract';
import { getRequestAuthContext } from './auth/request-context';
import { createPostgresNutritionRepository } from './db/postgres-nutrition-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { HttpError, getOptionalIntParam, getOptionalQueryParam } from './http';
import { analyzeNutritionAiFoodLog } from './nutrition-ai-food-log';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function body(request: Request) {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

function parseOrBadRequest<T>(reader: () => T) {
  try {
    return reader();
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid nutrition request.');
  }
}

function selectedDate(value: unknown) {
  const text = typeof value === 'string' && value.trim() ? value.trim() : new Intl.DateTimeFormat('en-CA').format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new HttpError(400, 'Invalid "date" query parameter. Expected YYYY-MM-DD.');
  return text;
}

function loggedAt(value: unknown) {
  const text = typeof value === 'string' && value.trim() ? value.trim() : new Date().toISOString();
  if (Number.isNaN(Date.parse(text))) throw new HttpError(400, 'Invalid "loggedAt" query parameter. Expected an ISO timestamp.');
  return text;
}

function createRepository(request: Request) {
  return createPostgresNutritionRepository(getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId));
}

export async function handleGetNutritionBootstrap(request: Request, response: Response) {
  sendJson(response, await createRepository(request).bootstrap(selectedDate(request.query.date)));
}

export async function handleSearchNutritionItems(request: Request, response: Response) {
  sendJson(response, { items: await createRepository(request).searchItems(getOptionalQueryParam(request.query.query) ?? '', loggedAt(request.query.loggedAt)) });
}

export async function handlePostNutritionAiFoodLog(request: Request, response: Response) {
  const input = parseOrBadRequest(() => parseNutritionAiFoodLogRequest(body(request)));
  const repository = createRepository(request);
  sendJson(response, await analyzeNutritionAiFoodLog(input.attachmentId, input.loggedAt, {
    searchItems: (query, iso, limit) => repository.searchItems(query, iso, limit),
    context: async (iso) => {
      const bootstrap = await repository.bootstrap(new Intl.DateTimeFormat('en-CA').format(new Date(iso)));
      return {
        recipes: bootstrap.recipes.map((recipe) => ({ name: recipe.name, servings: recipe.servings, totalWeightG: recipe.totalWeightG })),
        recentItems: bootstrap.recentItemNames,
        likelyItems: (await repository.searchItems('', iso, 12)).map((item) => ({ name: item.name, type: item.itemType, serving: item.defaultServingLabel ?? `${Math.round(item.defaultAmountG)}g` })),
      };
    },
  }));
}

export async function handleGetNutritionHistory(request: Request, response: Response) {
  const query = parseOrBadRequest(() => parseNutritionHistoryQuery({
    date: request.query.date,
    startDate: request.query.startDate,
    endDate: request.query.endDate,
    limit: getOptionalIntParam(request.query.limit, 20, 1, 100),
  }));
  sendJson(response, { entries: await createRepository(request).listDiaryEntries(query) });
}

export async function handleGetNutritionGoals(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).getGoals() });
}

export async function handlePutNutritionGoals(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveGoals(parseOrBadRequest(() => parseNutritionGoalsInput(body(request)))) });
}

export async function handleListNutritionRecipes(request: Request, response: Response) {
  sendJson(response, { items: (await createRepository(request).bootstrap(new Intl.DateTimeFormat('en-CA').format(new Date()))).recipes });
}

export async function handleCreateNutritionRecipe(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveRecipe(null, parseOrBadRequest(() => parseNutritionRecipeInput(body(request)))) });
}

export async function handlePutNutritionRecipe(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveRecipe(request.params.recipeId, parseOrBadRequest(() => parseNutritionRecipeInput(body(request)))) });
}

export async function handleCreateNutritionBrandFood(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveBrandFood(null, parseOrBadRequest(() => parseNutritionFoodInput(body(request)))) });
}

export async function handlePutNutritionBrandFood(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveBrandFood(request.params.foodId, parseOrBadRequest(() => parseNutritionFoodInput(body(request)))) });
}

export async function handleCreateNutritionEntry(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveDiaryEntry(null, parseOrBadRequest(() => parseNutritionDiaryEntryInput(body(request)))) });
}

export async function handlePutNutritionEntry(request: Request, response: Response) {
  sendJson(response, { item: await createRepository(request).saveDiaryEntry(request.params.entryId, parseOrBadRequest(() => parseNutritionDiaryEntryInput(body(request)))) });
}

export async function handleDeleteNutritionEntry(request: Request, response: Response) {
  if (!await createRepository(request).deleteDiaryEntry(request.params.entryId)) throw new HttpError(404, 'Nutrition entry was not found.');
  sendJson(response, { ok: true });
}

export async function handleCreateNutritionEntryItem(request: Request, response: Response) {
  const entry = await createRepository(request).addDiaryItem(request.params.entryId, parseOrBadRequest(() => parseNutritionDiaryEntryInput({ loggedAt: new Date().toISOString(), items: [body(request)] }).items[0]));
  if (!entry) throw new HttpError(404, 'Nutrition entry was not found.');
  sendJson(response, { item: entry });
}

export async function handlePutNutritionEntryItem(request: Request, response: Response) {
  const entry = await createRepository(request).updateDiaryItem(request.params.entryId, request.params.itemId, parseOrBadRequest(() => parseNutritionDiaryEntryInput({ loggedAt: new Date().toISOString(), items: [body(request)] }).items[0]));
  if (!entry) throw new HttpError(404, 'Nutrition entry was not found.');
  sendJson(response, { item: entry });
}

export async function handleDeleteNutritionEntryItem(request: Request, response: Response) {
  if (!await createRepository(request).deleteDiaryItem(request.params.entryId, request.params.itemId)) throw new HttpError(404, 'Nutrition entry item was not found.');
  sendJson(response, { ok: true });
}
