import assert from 'node:assert/strict';
import test from 'node:test';
import { getToolRegistryEntries } from './registry';
import { nutritionTool } from './nutrition-tool';

function invocation(functionName: string, args: Record<string, unknown> = {}) {
  return { toolId: 'nutrition', functionName, args, createdAt: '2026-06-24T00:00:00.000Z' };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

function withMockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => handler(String(input), init);
  return () => { globalThis.fetch = original; };
}

async function run(functionName: string, args: Record<string, unknown> = {}) {
  const result = await nutritionTool.execute(invocation(functionName, args), {});
  assert.equal('deferred' in result, false);
  if ('deferred' in result) throw new Error('nutrition tool should not defer');
  return result;
}

const sampleEntry = {
  id: 'entry-1',
  loggedAt: '2026-06-24T12:00:00.000Z',
  note: 'Lunch',
  nutritionTotal: { calories: 300, proteinG: 20, carbsG: 30, fatG: 10 },
  items: [],
  createdAt: '2026-06-24T12:00:00.000Z',
  updatedAt: '2026-06-24T12:00:00.000Z',
};

test('nutrition tool is registered and enabled by default', () => {
  const entry = getToolRegistryEntries().find((candidate) => candidate.definition.id === 'nutrition');
  assert.equal(entry?.definition.alias, '/nutrition');
  assert.equal(entry?.definition.enabledByDefault, true);
});

test('nutrition tool read functions hit the expected routes', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (url.includes('/bootstrap')) return json({ selectedDate: '2026-06-24', goals: { caloriesTarget: 2200, proteinTargetG: 160, carbsTargetG: 220, fatTargetG: 70, updatedAt: '2026-06-24T00:00:00.000Z' }, entries: [sampleEntry], recipes: [], recentItemNames: ['Apple'] });
    if (url.includes('/search')) return json({ items: [{ id: 'food_apple', itemType: 'food', name: 'Apple' }] });
    if (url.includes('/history')) return json({ entries: [sampleEntry] });
    if (url.includes('/goals')) return json({ item: { caloriesTarget: 2200, proteinTargetG: 160, carbsTargetG: 220, fatTargetG: 70, updatedAt: '2026-06-24T00:00:00.000Z' } });
    return json({ items: [{ id: 'recipe-1', name: 'Apple Bowl' }] });
  });
  try {
    await run('get_nutrition_overview', { date: '2026-06-24' });
    await run('search_nutrition_items', { query: 'apple', loggedAt: '2026-06-24T12:00:00.000Z' });
    await run('get_nutrition_history', { startDate: '2026-06-20', endDate: '2026-06-24', limit: 5 });
    await run('get_nutrition_goals');
    await run('list_nutrition_recipes');
    assert.deepEqual(calls, [
      'GET /api/nutrition/bootstrap?date=2026-06-24',
      'GET /api/nutrition/search?query=apple&loggedAt=2026-06-24T12%3A00%3A00.000Z',
      'GET /api/nutrition/history?startDate=2026-06-20&endDate=2026-06-24&limit=5',
      'GET /api/nutrition/goals',
      'GET /api/nutrition/recipes',
    ]);
  } finally {
    restore();
  }
});

test('nutrition tool write functions hit the expected routes', async () => {
  const calls: string[] = [];
  const restore = withMockFetch((url, init) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (init?.method === 'DELETE') return json({ ok: true });
    if (url.includes('/goals')) return json({ item: { caloriesTarget: 2300, proteinTargetG: 170, carbsTargetG: 210, fatTargetG: 65, updatedAt: '2026-06-24T00:00:00.000Z' } });
    if (url.includes('/foods/brands')) return json({ item: { id: 'food-1', name: 'Protein Bar' } });
    if (url.includes('/recipes')) return json({ item: { id: 'recipe-1', name: 'Protein Bowl' } });
    return json({ item: sampleEntry });
  });
  try {
    await run('create_nutrition_brand_food', { food: { name: 'Protein Bar', servings: [{ id: 'serving_1', label: '1 bar', amount: 1, grams: 50 }], nutritionPer100g: { calories: 400, proteinG: 30, carbsG: 35, fatG: 12 } } });
    await run('update_nutrition_brand_food', { foodId: 'food-1', food: { name: 'Protein Bar', servings: [{ id: 'serving_1', label: '1 bar', amount: 1, grams: 50 }], nutritionPer100g: { calories: 400, proteinG: 30, carbsG: 35, fatG: 12 } } });
    await run('create_nutrition_recipe', { recipe: { name: 'Protein Bowl', servings: 2, ingredients: [{ foodId: 'food_apple', amountG: 100 }] } });
    await run('update_nutrition_recipe', { recipeId: 'recipe-1', recipe: { name: 'Protein Bowl', servings: 2, ingredients: [{ foodId: 'food_apple', amountG: 100 }] } });
    await run('update_nutrition_goals', { goals: { caloriesTarget: 2300, proteinTargetG: 170, carbsTargetG: 210, fatTargetG: 65 } });
    await run('create_nutrition_entry', { entry: { loggedAt: '2026-06-24T12:00:00.000Z', items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' }] } });
    await run('update_nutrition_entry', { entryId: 'entry-1', entry: { loggedAt: '2026-06-24T13:00:00.000Z', items: [{ itemType: 'food', itemId: 'food_banana', quantity: 1, unit: 'serving', servingId: 'serving_1_medium' }] } });
    await run('delete_nutrition_entry', { entryId: 'entry-1' });
    await run('append_nutrition_entry_item', { entryId: 'entry-1', item: { itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' } });
    await run('update_nutrition_entry_item', { entryId: 'entry-1', itemId: 'item-1', item: { itemType: 'food', itemId: 'food_banana', quantity: 120, unit: 'gram' } });
    await run('delete_nutrition_entry_item', { entryId: 'entry-1', itemId: 'item-1' });
    assert.deepEqual(calls, [
      'POST /api/nutrition/foods/brands',
      'PUT /api/nutrition/foods/brands/food-1',
      'POST /api/nutrition/recipes',
      'PUT /api/nutrition/recipes/recipe-1',
      'PUT /api/nutrition/goals',
      'POST /api/nutrition/entries',
      'PUT /api/nutrition/entries/entry-1',
      'DELETE /api/nutrition/entries/entry-1',
      'POST /api/nutrition/entries/entry-1/items',
      'PUT /api/nutrition/entries/entry-1/items/item-1',
      'DELETE /api/nutrition/entries/entry-1/items/item-1',
    ]);
  } finally {
    restore();
  }
});

test('nutrition tool validates required fields and history rules', async () => {
  assert.equal((await run('create_nutrition_brand_food', {})).ok, false);
  assert.equal((await run('update_nutrition_entry_item', { entryId: 'entry-1', item: {} })).ok, false);
  assert.equal((await run('get_nutrition_history', { date: '2026-06-24', startDate: '2026-06-20', endDate: '2026-06-24' })).ok, false);
  assert.equal((await run('get_nutrition_history', { startDate: '2026-06-24' })).ok, false);
});
