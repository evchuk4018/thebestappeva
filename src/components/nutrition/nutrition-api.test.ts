import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNutritionBrandFood,
  createNutritionEntry,
  createNutritionRecipe,
  deleteNutritionEntryItem,
  fetchNutritionBootstrap,
  fetchNutritionGoals,
  fetchNutritionHistory,
  fetchNutritionRecipes,
  saveNutritionGoals,
  searchNutritionItems,
  updateNutritionEntry,
} from './nutrition-api';

const bootstrapPayload = {
  selectedDate: '2026-06-24',
  goals: { caloriesTarget: 2200, proteinTargetG: 160, carbsTargetG: 220, fatTargetG: 70, updatedAt: '2026-06-24T00:00:00.000Z' },
  entries: [],
  recipes: [],
  recentItemNames: [],
};

test('nutrition API loads bootstrap, search, and read routes', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`);
    const url = String(input);
    if (url.includes('/search')) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/goals')) return new Response(JSON.stringify({ item: bootstrapPayload.goals }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/recipes')) return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.includes('/history')) return new Response(JSON.stringify({ entries: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const payload = bootstrapPayload;
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await fetchNutritionBootstrap('2026-06-24');
    await searchNutritionItems('apple', '2026-06-24T12:00:00.000Z');
    await fetchNutritionGoals();
    await fetchNutritionRecipes();
    await fetchNutritionHistory({ date: '2026-06-24', limit: 3 });
    await fetchNutritionHistory({ startDate: '2026-06-20', endDate: '2026-06-24' });
    assert.deepEqual(calls, [
      'GET /api/nutrition/bootstrap?date=2026-06-24',
      'GET /api/nutrition/search?query=apple&loggedAt=2026-06-24T12%3A00%3A00.000Z',
      'GET /api/nutrition/goals',
      'GET /api/nutrition/recipes',
      'GET /api/nutrition/history?date=2026-06-24&limit=3',
      'GET /api/nutrition/history?startDate=2026-06-20&endDate=2026-06-24',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('nutrition API hits write routes for goals, foods, recipes, and entries', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method ?? 'GET'} ${input}`);
    return new Response(JSON.stringify({ item: bootstrapPayload.goals }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await saveNutritionGoals({ caloriesTarget: 2200, proteinTargetG: 160, carbsTargetG: 220, fatTargetG: 70 });
    await createNutritionBrandFood({ name: 'Cheese Crackers', servings: [{ id: 'serving_primary', label: '1 box', amount: 1, grams: 30 }], nutritionPer100g: { calories: 500, proteinG: 8, carbsG: 60, fatG: 24 } });
    await createNutritionRecipe({ name: 'Apple Pie', servings: 8, ingredients: [{ foodId: 'food_apple', amountG: 120 }] });
    await createNutritionEntry({ loggedAt: '2026-06-24T12:00:00.000Z', items: [{ itemType: 'food', itemId: 'food_apple', quantity: 120, unit: 'gram' }] });
    await updateNutritionEntry('entry-1', { loggedAt: '2026-06-24T13:00:00.000Z', items: [{ itemType: 'food', itemId: 'food_banana', quantity: 1, unit: 'serving' }] });
    assert.deepEqual(calls, [
      'PUT /api/nutrition/goals',
      'POST /api/nutrition/foods/brands',
      'POST /api/nutrition/recipes',
      'POST /api/nutrition/entries',
      'PUT /api/nutrition/entries/entry-1',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('nutrition API deletes entry items through the expected route', async () => {
  const originalFetch = globalThis.fetch;
  let call = '';
  globalThis.fetch = async (input, init) => {
    call = `${init?.method ?? 'GET'} ${input}`;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    await deleteNutritionEntryItem('entry-1', 'item-1');
    assert.equal(call, 'DELETE /api/nutrition/entries/entry-1/items/item-1');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
