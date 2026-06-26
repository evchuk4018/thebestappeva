import type { Request, Response } from 'express';
import { parseNutritionDiaryEntryInput, parseNutritionFoodInput, parseNutritionGoalsInput, parseNutritionHistoryQuery, parseNutritionRecipeInput } from '../shared/nutrition-contract';
import { HttpError, getOptionalIntParam, getOptionalQueryParam } from './http';
import { nutritionRepository } from './db/nutrition-repository';

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

export async function handleGetNutritionBootstrap(request: Request, response: Response) {
  sendJson(response, nutritionRepository.bootstrap(selectedDate(request.query.date)));
}

export async function handleSearchNutritionItems(request: Request, response: Response) {
  sendJson(response, { items: nutritionRepository.searchItems(getOptionalQueryParam(request.query.query) ?? '', loggedAt(request.query.loggedAt)) });
}

export async function handleGetNutritionHistory(request: Request, response: Response) {
  const query = parseOrBadRequest(() => parseNutritionHistoryQuery({
    date: request.query.date,
    startDate: request.query.startDate,
    endDate: request.query.endDate,
    limit: getOptionalIntParam(request.query.limit, 20, 1, 100),
  }));
  sendJson(response, { entries: nutritionRepository.listDiaryEntries(query) });
}

export async function handleGetNutritionGoals(_request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.getGoals() });
}

export async function handlePutNutritionGoals(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveGoals(parseOrBadRequest(() => parseNutritionGoalsInput(body(request)))) });
}

export async function handleListNutritionRecipes(_request: Request, response: Response) {
  sendJson(response, { items: nutritionRepository.bootstrap(new Intl.DateTimeFormat('en-CA').format(new Date())).recipes });
}

export async function handleCreateNutritionRecipe(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveRecipe(null, parseOrBadRequest(() => parseNutritionRecipeInput(body(request)))) });
}

export async function handlePutNutritionRecipe(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveRecipe(request.params.recipeId, parseOrBadRequest(() => parseNutritionRecipeInput(body(request)))) });
}

export async function handleCreateNutritionBrandFood(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveBrandFood(null, parseOrBadRequest(() => parseNutritionFoodInput(body(request)))) });
}

export async function handlePutNutritionBrandFood(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveBrandFood(request.params.foodId, parseOrBadRequest(() => parseNutritionFoodInput(body(request)))) });
}

export async function handleCreateNutritionEntry(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveDiaryEntry(null, parseOrBadRequest(() => parseNutritionDiaryEntryInput(body(request)))) });
}

export async function handlePutNutritionEntry(request: Request, response: Response) {
  sendJson(response, { item: nutritionRepository.saveDiaryEntry(request.params.entryId, parseOrBadRequest(() => parseNutritionDiaryEntryInput(body(request)))) });
}

export async function handleDeleteNutritionEntry(request: Request, response: Response) {
  if (!nutritionRepository.deleteDiaryEntry(request.params.entryId)) throw new HttpError(404, 'Nutrition entry was not found.');
  sendJson(response, { ok: true });
}

export async function handleCreateNutritionEntryItem(request: Request, response: Response) {
  const entry = nutritionRepository.addDiaryItem(request.params.entryId, parseOrBadRequest(() => parseNutritionDiaryEntryInput({ loggedAt: new Date().toISOString(), items: [body(request)] }).items[0]));
  if (!entry) throw new HttpError(404, 'Nutrition entry was not found.');
  sendJson(response, { item: entry });
}

export async function handlePutNutritionEntryItem(request: Request, response: Response) {
  const entry = nutritionRepository.updateDiaryItem(request.params.entryId, request.params.itemId, parseOrBadRequest(() => parseNutritionDiaryEntryInput({ loggedAt: new Date().toISOString(), items: [body(request)] }).items[0]));
  if (!entry) throw new HttpError(404, 'Nutrition entry was not found.');
  sendJson(response, { item: entry });
}

export async function handleDeleteNutritionEntryItem(request: Request, response: Response) {
  if (!nutritionRepository.deleteDiaryItem(request.params.entryId, request.params.itemId)) throw new HttpError(404, 'Nutrition entry item was not found.');
  sendJson(response, { ok: true });
}
