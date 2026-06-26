import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseNutritionDiaryEntryInput,
  parseNutritionFoodInput,
  parseNutritionGoalsInput,
  parseNutritionHistoryQuery,
  parseNutritionRecipeInput,
} from './nutrition-contract';

test('parses branded food input with servings and macros', () => {
  const food = parseNutritionFoodInput({
    name: 'Cheese Crackers',
    brandName: 'Local Brand',
    barcodeText: '12345',
    servings: [{ label: '27 crackers', amount: 1, grams: 30 }],
    nutritionPer100g: { calories: 500, proteinG: 8, carbsG: 63, fatG: 24 },
  });

  assert.equal(food.name, 'Cheese Crackers');
  assert.equal(food.brandName, 'Local Brand');
  assert.equal(food.servings[0].grams, 30);
});

test('parses recipe input and normalizes notes', () => {
  const recipe = parseNutritionRecipeInput({
    name: 'Apple Pie',
    note: '  quick log  ',
    servings: 8,
    ingredients: [
      { foodId: 'food_apple', amountG: 100 },
      { foodId: 'food_crust', amountG: 150, orderIndex: 2 },
    ],
  });

  assert.equal(recipe.note, 'quick log');
  assert.equal(recipe.ingredients.length, 2);
  assert.equal(recipe.ingredients[1].orderIndex, 2);
});

test('parses diary entry inputs for grams and servings', () => {
  const entry = parseNutritionDiaryEntryInput({
    loggedAt: '2026-06-24T12:00:00.000Z',
    items: [
      { itemType: 'food', itemId: 'food_apple', quantity: 150, unit: 'gram' },
      { itemType: 'recipe', itemId: 'recipe_pie', quantity: 1.5, unit: 'serving' },
    ],
  });

  assert.equal(entry.items[0].unit, 'gram');
  assert.equal(entry.items[1].itemType, 'recipe');
});

test('parses nutrition goals', () => {
  const goals = parseNutritionGoalsInput({
    caloriesTarget: 2200,
    proteinTargetG: 160,
    carbsTargetG: 210,
    fatTargetG: 70,
  });

  assert.equal(goals.caloriesTarget, 2200);
  assert.equal(goals.fatTargetG, 70);
});

test('rejects invalid diary units', () => {
  assert.throws(
    () => parseNutritionDiaryEntryInput({ loggedAt: '2026-06-24T12:00:00.000Z', items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'cup' }] }),
    /Expected "gram" or "serving"/,
  );
});

test('parses nutrition history queries for exact dates and ranges', () => {
  assert.deepEqual(parseNutritionHistoryQuery({ date: '2026-06-24', limit: 5 }), { date: '2026-06-24', startDate: undefined, endDate: undefined, limit: 5 });
  assert.deepEqual(parseNutritionHistoryQuery({ startDate: '2026-06-20', endDate: '2026-06-24' }), { date: undefined, startDate: '2026-06-20', endDate: '2026-06-24', limit: undefined });
});

test('rejects invalid nutrition history queries', () => {
  assert.throws(() => parseNutritionHistoryQuery({}), /Provide either date or startDate\/endDate/);
  assert.throws(() => parseNutritionHistoryQuery({ date: '2026-06-24', startDate: '2026-06-20', endDate: '2026-06-24' }), /either date or startDate\/endDate/);
  assert.throws(() => parseNutritionHistoryQuery({ startDate: '2026-06-24' }), /Provide both startDate and endDate together/);
  assert.throws(() => parseNutritionHistoryQuery({ startDate: '2026-06-25', endDate: '2026-06-24' }), /on or after startDate/);
});
