import type {
  NutritionBootstrap,
  NutritionDiaryEntry,
  NutritionDiaryEntryInput,
  NutritionDiaryItemInput,
  NutritionFood,
  NutritionFoodInput,
  NutritionGoals,
  NutritionGoalsInput,
  NutritionHistoryQuery,
  NutritionRecipe,
  NutritionRecipeInput,
  NutritionSearchItem,
} from '../../../shared/nutrition-contract';
import { parseNutritionAiFoodLogResponse, type NutritionAiFoodLogResponse } from '../../../shared/nutrition-ai-food-log-contract';
import { requestJson } from '../../lib/api';

export async function fetchNutritionBootstrap(date: string): Promise<NutritionBootstrap> {
  return requestJson('/nutrition/bootstrap', { query: { date } });
}

export async function searchNutritionItems(queryText: string, loggedAt: string): Promise<NutritionSearchItem[]> {
  return (await requestJson<{ items?: NutritionSearchItem[] }>('/nutrition/search', { query: { query: queryText, loggedAt } })).items ?? [];
}

export async function analyzeNutritionFoodImage(attachmentId: string, loggedAt: string): Promise<NutritionAiFoodLogResponse> {
  return parseNutritionAiFoodLogResponse(await requestJson('/nutrition/ai-food-log', {
    method: 'POST',
    json: { attachmentId, loggedAt },
  }));
}

export async function fetchNutritionGoals(): Promise<NutritionGoals> {
  return (await requestJson<{ item: NutritionGoals }>('/nutrition/goals')).item;
}

export async function saveNutritionGoals(input: NutritionGoalsInput): Promise<NutritionGoals> {
  return (await requestJson<{ item: NutritionGoals }>('/nutrition/goals', { method: 'PUT', json: input })).item;
}

export async function fetchNutritionRecipes(): Promise<NutritionRecipe[]> {
  return (await requestJson<{ items?: NutritionRecipe[] }>('/nutrition/recipes')).items ?? [];
}

export async function createNutritionBrandFood(input: NutritionFoodInput): Promise<NutritionFood> {
  return (await requestJson<{ item: NutritionFood }>('/nutrition/foods/brands', { method: 'POST', json: input })).item;
}

export async function updateNutritionBrandFood(foodId: string, input: NutritionFoodInput): Promise<NutritionFood> {
  return (await requestJson<{ item: NutritionFood }>(`/nutrition/foods/brands/${foodId}`, { method: 'PUT', json: input })).item;
}

export async function createNutritionRecipe(input: NutritionRecipeInput): Promise<NutritionRecipe> {
  return (await requestJson<{ item: NutritionRecipe }>('/nutrition/recipes', { method: 'POST', json: input })).item;
}

export async function updateNutritionRecipe(recipeId: string, input: NutritionRecipeInput): Promise<NutritionRecipe> {
  return (await requestJson<{ item: NutritionRecipe }>(`/nutrition/recipes/${recipeId}`, { method: 'PUT', json: input })).item;
}

export async function createNutritionEntry(input: NutritionDiaryEntryInput): Promise<NutritionDiaryEntry> {
  return (await requestJson<{ item: NutritionDiaryEntry }>('/nutrition/entries', { method: 'POST', json: input })).item;
}

export async function fetchNutritionHistory(history: NutritionHistoryQuery): Promise<NutritionDiaryEntry[]> {
  return (await requestJson<{ entries?: NutritionDiaryEntry[] }>('/nutrition/history', { query: {
    date: history.date,
    startDate: history.startDate,
    endDate: history.endDate,
    limit: history.limit,
  } })).entries ?? [];
}

export async function updateNutritionEntry(entryId: string, input: NutritionDiaryEntryInput): Promise<NutritionDiaryEntry> {
  return (await requestJson<{ item: NutritionDiaryEntry }>(`/nutrition/entries/${entryId}`, { method: 'PUT', json: input })).item;
}

export async function deleteNutritionEntry(entryId: string): Promise<void> {
  await requestJson(`/nutrition/entries/${entryId}`, { method: 'DELETE' });
}

export async function appendNutritionEntryItem(entryId: string, input: NutritionDiaryItemInput): Promise<NutritionDiaryEntry> {
  return (await requestJson<{ item: NutritionDiaryEntry }>(`/nutrition/entries/${entryId}/items`, { method: 'POST', json: input })).item;
}

export async function updateNutritionEntryItem(entryId: string, itemId: string, input: NutritionDiaryItemInput): Promise<NutritionDiaryEntry> {
  return (await requestJson<{ item: NutritionDiaryEntry }>(`/nutrition/entries/${entryId}/items/${itemId}`, { method: 'PUT', json: input })).item;
}

export async function deleteNutritionEntryItem(entryId: string, itemId: string): Promise<void> {
  await requestJson(`/nutrition/entries/${entryId}/items/${itemId}`, { method: 'DELETE' });
}
