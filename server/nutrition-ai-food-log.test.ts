import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelChatMessage } from '../shared/ai-runtime-contract';
import type { NutritionSearchItem } from '../shared/nutrition-contract';
import { serverConfig } from './config';
import { analyzeNutritionAiFoodLog } from './nutrition-ai-food-log';

const chili: NutritionSearchItem = {
  id: 'recipe_chili',
  itemType: 'recipe',
  name: 'Turkey Chili',
  brandName: null,
  subtitle: '5 ingredients',
  defaultAmountG: 250,
  defaultServingId: null,
  defaultServingLabel: '1 serving',
  nutrition: { calories: 320, proteinG: 28, carbsG: 25, fatG: 12 },
  score: 78,
};

const rice: NutritionSearchItem = {
  id: 'food_rice',
  itemType: 'food',
  name: 'Rice',
  brandName: null,
  subtitle: 'Whole food',
  defaultAmountG: 158,
  defaultServingId: 'serving_1_cup',
  defaultServingLabel: '1 cup',
  nutrition: { calories: 205, proteinG: 4, carbsG: 45, fatG: 0.4 },
  score: 120,
};

const image = { attachmentId: 'image_meal', imageBase64: 'abc', mediaType: 'image/png', summary: 'A bowl with chili and rice.' };

function deepSeekJson(payload: unknown) {
  return async () => JSON.stringify(payload);
}

function searchItems(query: string) {
  if (/chili/i.test(query)) return [chili];
  if (/rice/i.test(query)) return [rice];
  return [];
}

test('nutrition AI food log matches a gram amount to a saved recipe', async () => {
  const response = await analyzeNutritionAiFoodLog('image_meal', '2026-06-24T18:00:00.000Z', {
    loadImage: async () => image,
    deepSeek: deepSeekJson({ items: [{ name: 'chili', quantity: 100, unit: 'gram', confidence: 'medium' }] }),
    searchItems,
    context: () => ({}),
  });

  assert.equal(response.items[0].matchedItem?.id, 'recipe_chili');
  assert.equal(response.items[0].quantity, 100);
  assert.equal(response.items[0].unit, 'gram');
});

test('nutrition AI food log returns multiple matched draft rows', async () => {
  const response = await analyzeNutritionAiFoodLog('image_meal', '2026-06-24T12:00:00.000Z', {
    loadImage: async () => image,
    deepSeek: deepSeekJson({ items: [
      { name: 'chili', quantity: 1, unit: 'serving', confidence: 'high' },
      { name: 'rice', quantity: 100, unit: 'gram', confidence: 'medium' },
    ] }),
    searchItems,
    context: () => ({}),
  });

  assert.deepEqual(response.items.map((item) => item.matchedItem?.id), ['recipe_chili', 'food_rice']);
});

test('nutrition AI food log leaves unmatched rows unsaveable for review', async () => {
  const response = await analyzeNutritionAiFoodLog('image_meal', '2026-06-24T12:00:00.000Z', {
    loadImage: async () => image,
    deepSeek: deepSeekJson({ items: [{ name: 'mystery sauce', quantity: 1, unit: 'serving', confidence: 'low' }] }),
    searchItems,
    context: () => ({}),
  });

  assert.equal(response.items[0].matchedItem, null);
  assert.equal(response.items[0].needsReview, true);
  assert.match(response.warnings.join('\n'), /No local food or recipe match/);
});

test('nutrition AI food log caps Gemini follow-up questions at two', async () => {
  let geminiCalls = 0;
  const deepSeekCalls: ModelChatMessage[][] = [];
  const response = await analyzeNutritionAiFoodLog('image_meal', '2026-06-24T12:00:00.000Z', {
    loadImage: async () => image,
    deepSeek: async (messages) => {
      deepSeekCalls.push(messages);
      return deepSeekCalls.length === 1
        ? JSON.stringify({ followUpQuestions: ['How much chili?', 'Is there rice?', 'Any cheese?'] })
        : JSON.stringify({ items: [{ name: 'rice', quantity: 100, unit: 'gram', confidence: 'medium' }] });
    },
    gemini: async () => {
      geminiCalls += 1;
      return 'visual answer';
    },
    searchItems,
    context: () => ({}),
  });

  assert.equal(geminiCalls, 2);
  assert.equal(deepSeekCalls.length, 2);
  assert.equal(response.items[0].matchedItem?.id, 'food_rice');
});

test('nutrition AI food log reports missing DeepSeek configuration', async () => {
  const previous = serverConfig.deepseekApiKey;
  serverConfig.deepseekApiKey = '';
  try {
    await assert.rejects(
      () => analyzeNutritionAiFoodLog('image_meal', '2026-06-24T12:00:00.000Z', { loadImage: async () => image, context: () => ({}) }),
      /DEEPSEEK_API_KEY/,
    );
  } finally {
    serverConfig.deepseekApiKey = previous;
  }
});
