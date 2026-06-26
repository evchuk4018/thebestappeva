import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNutritionAiFoodLogRequest, parseNutritionAiFoodLogResponse } from './nutrition-ai-food-log-contract';

const searchItem = {
  id: 'recipe_chili',
  itemType: 'recipe',
  name: 'Chili',
  brandName: null,
  subtitle: '4 ingredients',
  defaultAmountG: 250,
  defaultServingId: null,
  defaultServingLabel: '1 serving',
  nutrition: { calories: 300, proteinG: 22, carbsG: 30, fatG: 10 },
  score: 120,
};

test('parses nutrition AI food log request', () => {
  const request = parseNutritionAiFoodLogRequest({
    attachmentId: 'image_abc123',
    loggedAt: '2026-06-24T12:00:00.000Z',
  });

  assert.equal(request.attachmentId, 'image_abc123');
  assert.equal(request.loggedAt, '2026-06-24T12:00:00.000Z');
});

test('parses nutrition AI food log response with matched and unmatched rows', () => {
  const response = parseNutritionAiFoodLogResponse({
    attachmentId: 'image_abc123',
    summary: 'A bowl of chili with rice.',
    warnings: ['Review portion sizes.'],
    trace: [{ provider: 'deepseek', action: 'draft', detail: 'Created 2 draft rows.' }],
    items: [
      {
        id: 'draft_1',
        name: 'chili',
        quantity: 100,
        unit: 'gram',
        note: 'Model estimated portion.',
        confidence: 'medium',
        needsReview: true,
        matchedItem: searchItem,
        candidates: [searchItem],
      },
      {
        id: 'draft_2',
        name: 'unknown sauce',
        quantity: 1,
        unit: 'serving',
        confidence: 'low',
        needsReview: true,
        matchedItem: null,
        candidates: [],
      },
    ],
  });

  assert.equal(response.items[0].matchedItem?.id, 'recipe_chili');
  assert.equal(response.items[1].matchedItem, null);
  assert.equal(response.trace[0].provider, 'deepseek');
});

test('rejects invalid nutrition AI food log payloads', () => {
  assert.throws(() => parseNutritionAiFoodLogRequest({ attachmentId: '', loggedAt: '2026-06-24T12:00:00.000Z' }), /attachmentId/);
  assert.throws(() => parseNutritionAiFoodLogRequest({ attachmentId: 'image_1', loggedAt: 'today' }), /loggedAt/);
  assert.throws(() => parseNutritionAiFoodLogResponse({ attachmentId: 'image_1', summary: 'x', items: [{ id: 'x', unit: 'gram' }] }), /name/);
});
