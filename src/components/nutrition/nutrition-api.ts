import type {
  NutritionBootstrap,
  NutritionDiaryEntry,
  NutritionDiaryEntryInput,
  NutritionDiaryItemInput,
  NutritionFood,
  NutritionFoodInput,
  NutritionGoals,
  NutritionGoalsInput,
  NutritionRecipe,
  NutritionRecipeInput,
  NutritionSearchItem,
} from '../../../shared/nutrition-contract';

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({ error: 'The local server returned invalid JSON.' }));
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with ${response.status}.`);
  return payload;
}

async function json(path: string, init?: RequestInit) {
  return readJson(await fetch(path, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init }));
}

function query(path: string, params: Record<string, string | number | null | undefined>) {
  const baseUrl = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(path, baseUrl);
  Object.entries(params).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== '') url.searchParams.set(key, String(value)); });
  return `${url.pathname}${url.search}`;
}

export async function fetchNutritionBootstrap(date: string): Promise<NutritionBootstrap> {
  return json(query('/api/nutrition/bootstrap', { date }));
}

export async function searchNutritionItems(queryText: string, loggedAt: string): Promise<NutritionSearchItem[]> {
  return (await json(query('/api/nutrition/search', { query: queryText, loggedAt }))).items ?? [];
}

export async function saveNutritionGoals(input: NutritionGoalsInput): Promise<NutritionGoals> {
  return (await json('/api/nutrition/goals', { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function createNutritionBrandFood(input: NutritionFoodInput): Promise<NutritionFood> {
  return (await json('/api/nutrition/foods/brands', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateNutritionBrandFood(foodId: string, input: NutritionFoodInput): Promise<NutritionFood> {
  return (await json(`/api/nutrition/foods/brands/${foodId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function createNutritionRecipe(input: NutritionRecipeInput): Promise<NutritionRecipe> {
  return (await json('/api/nutrition/recipes', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateNutritionRecipe(recipeId: string, input: NutritionRecipeInput): Promise<NutritionRecipe> {
  return (await json(`/api/nutrition/recipes/${recipeId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function createNutritionEntry(input: NutritionDiaryEntryInput): Promise<NutritionDiaryEntry> {
  return (await json('/api/nutrition/entries', { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateNutritionEntry(entryId: string, input: NutritionDiaryEntryInput): Promise<NutritionDiaryEntry> {
  return (await json(`/api/nutrition/entries/${entryId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function deleteNutritionEntry(entryId: string): Promise<void> {
  await json(`/api/nutrition/entries/${entryId}`, { method: 'DELETE' });
}

export async function appendNutritionEntryItem(entryId: string, input: NutritionDiaryItemInput): Promise<NutritionDiaryEntry> {
  return (await json(`/api/nutrition/entries/${entryId}/items`, { method: 'POST', body: JSON.stringify(input) })).item;
}

export async function updateNutritionEntryItem(entryId: string, itemId: string, input: NutritionDiaryItemInput): Promise<NutritionDiaryEntry> {
  return (await json(`/api/nutrition/entries/${entryId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(input) })).item;
}

export async function deleteNutritionEntryItem(entryId: string, itemId: string): Promise<void> {
  await json(`/api/nutrition/entries/${entryId}/items/${itemId}`, { method: 'DELETE' });
}
