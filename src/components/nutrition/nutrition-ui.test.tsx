import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { NutritionDiaryEntry, NutritionGoals, NutritionRecipe } from '../../../shared/nutrition-contract';
import HomePage from '../HomePage';
import { NutritionBottomNav } from './NutritionBottomNav';
import { NutritionDashboard } from './NutritionDashboard';
import { NutritionAiFoodLogReviewSheet } from './NutritionAiFoodLogReviewSheet';
import { NutritionQuickActionMenu } from './NutritionQuickActionMenu';
import { NutritionRecipesView } from './NutritionRecipesView';
import { NutritionSearchSheet } from './NutritionSearchSheet';
import { WorkoutSessionSummaryProvider } from '../workout/WorkoutSessionSummaryContext';

const goals: NutritionGoals = {
  caloriesTarget: 2200,
  proteinTargetG: 160,
  carbsTargetG: 220,
  fatTargetG: 70,
  updatedAt: '2026-06-24T00:00:00.000Z',
};

const entry: NutritionDiaryEntry = {
  id: 'entry-1',
  loggedAt: '2026-06-24T12:00:00.000Z',
  note: 'Lunch',
  nutritionTotal: { calories: 420, proteinG: 12, carbsG: 68, fatG: 10 },
  items: [{
    id: 'item-1',
    itemType: 'food',
    itemId: 'food_apple',
    name: 'Apple',
    brandName: null,
    quantity: 140,
    unit: 'gram',
    amountG: 140,
    servingId: null,
    servingLabel: null,
    nutrition: { calories: 73, proteinG: 0.4, carbsG: 19, fatG: 0.2 },
  }],
  createdAt: '2026-06-24T12:00:00.000Z',
  updatedAt: '2026-06-24T12:00:00.000Z',
};

const recipe: NutritionRecipe = {
  id: 'recipe-1',
  name: 'Apple Pie',
  note: 'Quick log dessert.',
  servings: 8,
  totalWeightG: 960,
  nutritionPerServing: { calories: 240, proteinG: 4, carbsG: 34, fatG: 10 },
  nutritionTotal: { calories: 1920, proteinG: 32, carbsG: 272, fatG: 80 },
  ingredients: [{
    id: 'ingredient-1',
    foodId: 'food_apple',
    foodName: 'Apple',
    foodSourceType: 'whole',
    brandName: null,
    amountG: 300,
    orderIndex: 0,
    nutrition: { calories: 156, proteinG: 1.2, carbsG: 40.5, fatG: 0.9 },
  }],
  createdAt: '2026-06-24T00:00:00.000Z',
  updatedAt: '2026-06-24T00:00:00.000Z',
};

test('home page includes the nutrition launcher card', () => {
  const html = renderToStaticMarkup(<MemoryRouter><WorkoutSessionSummaryProvider><HomePage /></WorkoutSessionSummaryProvider></MemoryRouter>);
  assert.match(html, /Nutrition/);
  assert.match(html, /Food logging, goals, search ranking, and quick-log recipes/);
});

test('renders redesigned nutrition dashboard card and meals section', () => {
  const html = renderToStaticMarkup(<NutritionDashboard entries={[entry]} goals={goals} selectedDate="2026-06-24" weekEntries={[entry]} onDeleteEntry={() => {}} onEditEntry={() => {}} onEditGoals={() => {}} />);
  assert.match(html, /Calorie Budget/);
  assert.match(html, /View All Meals/);
  assert.doesNotMatch(html, /My Daily Advice/);
  assert.match(html, /All Meals/);
  assert.match(html, /Lunch/);
});

test('renders nutrition dashboard and home bottom navigation', () => {
  const html = renderToStaticMarkup(<NutritionBottomNav active="dashboard" onAiFoodLog={() => {}} onDashboard={() => {}} onHome={() => {}} onLogFood={() => {}} onOpenRecipes={() => {}} />);
  assert.match(html, /Dashboard/);
  assert.match(html, /Open nutrition quick actions/);
  assert.match(html, /Home/);
});

test('renders nutrition quick action menu choices', () => {
  const html = renderToStaticMarkup(<NutritionQuickActionMenu open onAiFoodLog={() => {}} onClose={() => {}} onLogFood={() => {}} onOpenRecipes={() => {}} />);
  assert.match(html, /Log Food/);
  assert.match(html, /AI Food Log/);
  assert.doesNotMatch(html, /Add Food/);
  assert.match(html, /Recipes/);
});

test('renders AI food log review rows with unmatched blocking state', () => {
  const html = renderToStaticMarkup(<NutritionAiFoodLogReviewSheet
    dateText="2026-06-24"
    response={{
      attachmentId: 'image_1',
      summary: 'A bowl of chili.',
      warnings: ['Review portions.'],
      trace: [],
      items: [
        { id: 'draft_1', name: 'chili', quantity: 100, unit: 'gram', note: '', confidence: 'medium', needsReview: true, matchedItem: { id: 'recipe-1', itemType: 'recipe', name: 'Apple Pie', brandName: null, subtitle: '1 ingredient', defaultAmountG: 120, defaultServingId: null, defaultServingLabel: '1 serving', nutrition: { calories: 240, proteinG: 4, carbsG: 34, fatG: 10 }, score: 80 }, candidates: [] },
        { id: 'draft_2', name: 'sauce', quantity: 1, unit: 'serving', note: '', confidence: 'low', needsReview: true, matchedItem: null, candidates: [] },
      ],
    }}
    onClose={() => {}}
    onSave={() => {}}
    onSearch={async () => []}
  />);
  assert.match(html, /Review meal draft/);
  assert.match(html, /Needs a local food or recipe match before saving/);
  assert.match(html, /Save Entry/);
});

test('renders add-new-food fallback in the nutrition search sheet', () => {
  const html = renderToStaticMarkup(<NutritionSearchSheet query="cheez" results={[]} onClose={() => {}} onCreateFood={() => {}} onPick={() => {}} onQueryChange={() => {}} />);
  assert.match(html, /Add new food/);
  assert.match(html, /No close match found/);
});

test('renders recipe detail and quick-log action', () => {
  const html = renderToStaticMarkup(<NutritionRecipesView recipes={[recipe]} onCreate={() => {}} onEdit={() => {}} onLog={() => {}} />);
  assert.match(html, /Recipe Detail/);
  assert.match(html, /Quick Log Recipe/);
  assert.match(html, /Apple Pie/);
});
