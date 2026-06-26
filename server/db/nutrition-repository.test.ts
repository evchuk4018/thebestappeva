import assert from 'node:assert/strict';
import test from 'node:test';
import BetterSqlite3 from 'better-sqlite3';
import { ensureDatabaseSchema } from './schema';
import { createNutritionRepository } from './nutrition-repository';

function createTestRepository() {
  const database = new BetterSqlite3(':memory:');
  database.pragma('foreign_keys = ON');
  ensureDatabaseSchema(database);
  let currentNow = '2026-06-24T12:00:00.000Z';
  return {
    database,
    repository: createNutritionRepository(database, () => currentNow),
    setNow(next: string) { currentNow = next; },
  };
}

test('creates nutrition schema and seeds whole foods idempotently', () => {
  const { database, repository } = createTestRepository();
  repository.ensureDefaults();
  repository.ensureDefaults();

  const tables = database.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'nutrition_%' ORDER BY name`).all() as Array<{ name: string }>;
  const wholeFoodCount = Number((database.prepare(`SELECT COUNT(*) AS count FROM nutrition_foods WHERE source_type = 'whole'`).get() as { count: number }).count);

  assert.deepEqual(tables.map((entry) => entry.name), [
    'nutrition_diary_entries',
    'nutrition_diary_items',
    'nutrition_foods',
    'nutrition_goals',
    'nutrition_recipe_ingredients',
    'nutrition_recipes',
    'nutrition_usage_stats',
  ]);
  assert.ok(wholeFoodCount > 150);
});

test('creates branded foods and rolls recipe nutrition from ingredients', () => {
  const { repository } = createTestRepository();
  repository.ensureDefaults();
  const brandFood = repository.saveBrandFood(null, {
    name: 'Cheese Crackers',
    brandName: 'Snack Co',
    barcodeText: '12345',
    servings: [{ id: 'serving_box', label: '1 box', amount: 1, grams: 30 }],
    nutritionPer100g: { calories: 500, proteinG: 9, carbsG: 61, fatG: 24 },
  });

  const recipe = repository.saveRecipe(null, {
    name: 'Apple Cracker Bowl',
    servings: 2,
    ingredients: [
      { foodId: 'food_apple', amountG: 180 },
      { foodId: brandFood.id, amountG: 30 },
    ],
  });

  assert.equal(recipe.ingredients.length, 2);
  assert.equal(Math.round(recipe.totalWeightG), 210);
  assert.ok(recipe.nutritionPerServing.calories > 100);
});

test('stores diary entries, rebuilds usage stats, and boosts frequent morning foods', () => {
  const { repository, setNow } = createTestRepository();
  repository.ensureDefaults();

  repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-24T08:00:00.000Z',
    items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' }],
  });
  repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-23T08:10:00.000Z',
    items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' }],
  });
  repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-24T19:00:00.000Z',
    items: [{ itemType: 'food', itemId: 'food_salmon', quantity: 1, unit: 'serving', servingId: 'serving_4_oz' }],
  });
  setNow('2026-06-24T08:30:00.000Z');

  const results = repository.searchItems('', '2026-06-24T08:30:00.000Z');
  const bootstrap = repository.bootstrap('2026-06-24');

  assert.equal(bootstrap.entries.length, 2);
  assert.equal(results[0].name, 'Apple');
});

test('lists nutrition diary history by exact date and inclusive date range with limits', () => {
  const { repository } = createTestRepository();
  repository.ensureDefaults();

  const breakfast = repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-24T08:00:00.000Z',
    note: 'Breakfast',
    items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' }],
  });
  repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-23T12:00:00.000Z',
    note: 'Lunch',
    items: [{ itemType: 'food', itemId: 'food_banana', quantity: 1, unit: 'serving', servingId: 'serving_1_medium' }],
  });
  repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-22T18:00:00.000Z',
    note: 'Dinner',
    items: [{ itemType: 'food', itemId: 'food_salmon', quantity: 1, unit: 'serving', servingId: 'serving_4_oz' }],
  });

  const exact = repository.listDiaryEntries({ date: '2026-06-24' });
  const range = repository.listDiaryEntries({ startDate: '2026-06-22', endDate: '2026-06-24' });
  const limited = repository.listDiaryEntries({ startDate: '2026-06-22', endDate: '2026-06-24', limit: 2 });

  assert.equal(exact.length, 1);
  assert.equal(exact[0].id, breakfast.id);
  assert.deepEqual(range.map((entry) => entry.note), ['Breakfast', 'Lunch', 'Dinner']);
  assert.deepEqual(limited.map((entry) => entry.note), ['Breakfast', 'Lunch']);
});

test('updates and deletes diary entries cleanly', () => {
  const { repository } = createTestRepository();
  repository.ensureDefaults();
  const entry = repository.saveDiaryEntry(null, {
    loggedAt: '2026-06-24T12:00:00.000Z',
    note: 'Lunch',
    items: [{ itemType: 'food', itemId: 'food_apple', quantity: 140, unit: 'gram' }],
  });

  const updated = repository.saveDiaryEntry(entry.id, {
    loggedAt: '2026-06-24T12:15:00.000Z',
    note: 'Lunch updated',
    items: [{ itemType: 'food', itemId: 'food_banana', quantity: 1, unit: 'serving', servingId: 'serving_1_medium' }],
  });

  assert.equal(updated.note, 'Lunch updated');
  assert.equal(updated.items[0].name, 'Banana');
  assert.equal(repository.deleteDiaryEntry(entry.id), true);
  assert.equal(repository.bootstrap('2026-06-24').entries.length, 0);
});
