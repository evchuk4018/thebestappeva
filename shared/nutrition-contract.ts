export interface NutritionMacroValues {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionServing {
  id: string;
  label: string;
  amount: number;
  grams: number;
}

export interface NutritionFood {
  id: string;
  name: string;
  sourceType: 'whole' | 'brand';
  brandName: string | null;
  barcodeText: string | null;
  servings: NutritionServing[];
  nutritionPer100g: NutritionMacroValues;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionFoodInput {
  name: string;
  brandName?: string | null;
  barcodeText?: string | null;
  servings: NutritionServing[];
  nutritionPer100g: NutritionMacroValues;
}

export interface NutritionRecipeIngredient {
  id: string;
  foodId: string;
  foodName: string;
  foodSourceType: 'whole' | 'brand';
  brandName: string | null;
  amountG: number;
  orderIndex: number;
  nutrition: NutritionMacroValues;
}

export interface NutritionRecipe {
  id: string;
  name: string;
  note: string;
  servings: number;
  totalWeightG: number;
  nutritionPerServing: NutritionMacroValues;
  nutritionTotal: NutritionMacroValues;
  ingredients: NutritionRecipeIngredient[];
  createdAt: string;
  updatedAt: string;
}

export interface NutritionRecipeInput {
  name: string;
  note?: string;
  servings: number;
  ingredients: Array<{ foodId: string; amountG: number; orderIndex?: number }>;
}

export interface NutritionDiaryItem {
  id: string;
  itemType: 'food' | 'recipe';
  itemId: string;
  name: string;
  brandName: string | null;
  quantity: number;
  unit: 'gram' | 'serving';
  amountG: number;
  servingId: string | null;
  servingLabel: string | null;
  nutrition: NutritionMacroValues;
}

export interface NutritionDiaryEntry {
  id: string;
  loggedAt: string;
  note: string;
  nutritionTotal: NutritionMacroValues;
  items: NutritionDiaryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface NutritionDiaryItemInput {
  itemType: 'food' | 'recipe';
  itemId: string;
  quantity: number;
  unit: 'gram' | 'serving';
  servingId?: string | null;
}

export interface NutritionDiaryEntryInput {
  loggedAt: string;
  note?: string;
  items: NutritionDiaryItemInput[];
}

export interface NutritionGoals {
  caloriesTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  updatedAt: string;
}

export interface NutritionGoalsInput {
  caloriesTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
}

export interface NutritionSearchItem {
  id: string;
  itemType: 'food' | 'recipe';
  name: string;
  brandName: string | null;
  subtitle: string;
  defaultAmountG: number;
  defaultServingId: string | null;
  defaultServingLabel: string | null;
  nutrition: NutritionMacroValues;
  score: number;
}

export interface NutritionBootstrap {
  selectedDate: string;
  goals: NutritionGoals;
  entries: NutritionDiaryEntry[];
  recipes: NutritionRecipe[];
  recentItemNames: string[];
}

export interface NutritionHistoryQuery {
  date?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

function record(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an object.`);
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid ${field}. Expected a non-empty string.`);
  return value.trim();
}

function numeric(value: unknown, field: string, minimum = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum) throw new Error(`Invalid ${field}. Expected a number >= ${minimum}.`);
  return number;
}

function integer(value: unknown, field: string, minimum = 1) {
  const number = numeric(value, field, minimum);
  if (!Number.isInteger(number)) throw new Error(`Invalid ${field}. Expected an integer >= ${minimum}.`);
  return number;
}

function iso(value: unknown, field: string) {
  const text = nonEmpty(value, field);
  if (Number.isNaN(Date.parse(text))) throw new Error(`Invalid ${field}. Expected an ISO timestamp.`);
  return text;
}

function dateOnly(value: unknown, field: string) {
  const text = nonEmpty(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`Invalid ${field}. Expected YYYY-MM-DD.`);
  return text;
}

function arr(value: unknown, field: string) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}. Expected an array.`);
  return value;
}

function parseMacros(value: unknown, field: string): NutritionMacroValues {
  const item = record(value, field);
  return {
    calories: numeric(item.calories, `${field}.calories`),
    proteinG: numeric(item.proteinG, `${field}.proteinG`),
    carbsG: numeric(item.carbsG, `${field}.carbsG`),
    fatG: numeric(item.fatG, `${field}.fatG`),
  };
}

function parseServing(value: unknown, field: string, index: number): NutritionServing {
  const item = record(value, field);
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `serving_${index + 1}`,
    label: nonEmpty(item.label, `${field}.label`),
    amount: numeric(item.amount, `${field}.amount`, 0.01),
    grams: numeric(item.grams, `${field}.grams`, 0.01),
  };
}

export function parseNutritionFoodInput(value: unknown, field = 'Nutrition food input'): NutritionFoodInput {
  const item = record(value, field);
  return {
    name: nonEmpty(item.name, `${field}.name`),
    brandName: typeof item.brandName === 'string' && item.brandName.trim() ? item.brandName.trim() : null,
    barcodeText: typeof item.barcodeText === 'string' && item.barcodeText.trim() ? item.barcodeText.trim() : null,
    servings: arr(item.servings, `${field}.servings`).map((entry, index) => parseServing(entry, `${field}.servings[${index}]`, index)),
    nutritionPer100g: parseMacros(item.nutritionPer100g, `${field}.nutritionPer100g`),
  };
}

export function parseNutritionRecipeInput(value: unknown, field = 'Nutrition recipe input'): NutritionRecipeInput {
  const item = record(value, field);
  return {
    name: nonEmpty(item.name, `${field}.name`),
    note: typeof item.note === 'string' ? item.note.trim() : '',
    servings: numeric(item.servings, `${field}.servings`, 0.01),
    ingredients: arr(item.ingredients, `${field}.ingredients`).map((entry, index) => {
      const ingredient = record(entry, `${field}.ingredients[${index}]`);
      return {
        foodId: nonEmpty(ingredient.foodId, `${field}.ingredients[${index}].foodId`),
        amountG: numeric(ingredient.amountG, `${field}.ingredients[${index}].amountG`, 0.01),
        orderIndex: numeric(ingredient.orderIndex ?? index, `${field}.ingredients[${index}].orderIndex`),
      };
    }),
  };
}

export function parseNutritionDiaryEntryInput(value: unknown, field = 'Nutrition diary entry input'): NutritionDiaryEntryInput {
  const item = record(value, field);
  return {
    loggedAt: iso(item.loggedAt, `${field}.loggedAt`),
    note: typeof item.note === 'string' ? item.note.trim() : '',
    items: arr(item.items, `${field}.items`).map((entry, index) => {
      const diaryItem = record(entry, `${field}.items[${index}]`);
      const itemType = diaryItem.itemType === 'recipe' ? 'recipe' : diaryItem.itemType === 'food' ? 'food' : null;
      const unit = diaryItem.unit === 'serving' ? 'serving' : diaryItem.unit === 'gram' ? 'gram' : null;
      if (!itemType) throw new Error(`Invalid ${field}.items[${index}].itemType. Expected "food" or "recipe".`);
      if (!unit) throw new Error(`Invalid ${field}.items[${index}].unit. Expected "gram" or "serving".`);
      return {
        itemType,
        itemId: nonEmpty(diaryItem.itemId, `${field}.items[${index}].itemId`),
        quantity: numeric(diaryItem.quantity, `${field}.items[${index}].quantity`, 0.01),
        unit,
        servingId: typeof diaryItem.servingId === 'string' && diaryItem.servingId.trim() ? diaryItem.servingId.trim() : null,
      };
    }),
  };
}

export function parseNutritionGoalsInput(value: unknown, field = 'Nutrition goals input'): NutritionGoalsInput {
  const item = record(value, field);
  return {
    caloriesTarget: numeric(item.caloriesTarget, `${field}.caloriesTarget`),
    proteinTargetG: numeric(item.proteinTargetG, `${field}.proteinTargetG`),
    carbsTargetG: numeric(item.carbsTargetG, `${field}.carbsTargetG`),
    fatTargetG: numeric(item.fatTargetG, `${field}.fatTargetG`),
  };
}

export function parseNutritionHistoryQuery(value: unknown, field = 'Nutrition history query'): NutritionHistoryQuery {
  const item = record(value, field);
  const date = typeof item.date === 'string' && item.date.trim() ? dateOnly(item.date, `${field}.date`) : undefined;
  const startDate = typeof item.startDate === 'string' && item.startDate.trim() ? dateOnly(item.startDate, `${field}.startDate`) : undefined;
  const endDate = typeof item.endDate === 'string' && item.endDate.trim() ? dateOnly(item.endDate, `${field}.endDate`) : undefined;
  const limit = item.limit === undefined || item.limit === null || item.limit === '' ? undefined : integer(item.limit, `${field}.limit`);

  if (date && (startDate || endDate)) {
    throw new Error(`Invalid ${field}. Provide either date or startDate/endDate, not both.`);
  }
  if (!date && Boolean(startDate) !== Boolean(endDate)) {
    throw new Error(`Invalid ${field}. Provide both startDate and endDate together.`);
  }
  if (!date && !startDate && !endDate) {
    throw new Error(`Invalid ${field}. Provide either date or startDate/endDate.`);
  }
  if (startDate && endDate && endDate < startDate) {
    throw new Error(`Invalid ${field}.endDate. Expected a date on or after startDate.`);
  }

  return { date, startDate, endDate, limit };
}
