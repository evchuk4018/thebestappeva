import type {
  NutritionDiaryEntry,
  NutritionDiaryItem,
  NutritionFood,
  NutritionGoals,
  NutritionMacroValues,
  NutritionRecipe,
  NutritionRecipeIngredient,
  NutritionServing,
} from '../../shared/nutrition-contract';

export type NutritionRow = Record<string, string | number | null>;

function parseServings(value: string | number | null) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : [];
  return Array.isArray(parsed) ? parsed as NutritionServing[] : [];
}

export function macrosFromRow(row: NutritionRow, prefix = ''): NutritionMacroValues {
  return {
    calories: Number(row[`${prefix}calories`]),
    proteinG: Number(row[`${prefix}protein_g`]),
    carbsG: Number(row[`${prefix}carbs_g`]),
    fatG: Number(row[`${prefix}fat_g`]),
  };
}

export function mapFood(row: NutritionRow): NutritionFood {
  return {
    id: String(row.id),
    name: String(row.name),
    sourceType: row.source_type === 'brand' ? 'brand' : 'whole',
    brandName: row.brand_name ? String(row.brand_name) : null,
    barcodeText: row.barcode_text ? String(row.barcode_text) : null,
    servings: parseServings(row.servings_json),
    nutritionPer100g: {
      calories: Number(row.calories_per_100g),
      proteinG: Number(row.protein_g_per_100g),
      carbsG: Number(row.carbs_g_per_100g),
      fatG: Number(row.fat_g_per_100g),
    },
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapRecipeIngredient(row: NutritionRow, nutrition: NutritionMacroValues): NutritionRecipeIngredient {
  return {
    id: String(row.id),
    foodId: String(row.food_id),
    foodName: String(row.food_name),
    foodSourceType: row.food_source_type === 'brand' ? 'brand' : 'whole',
    brandName: row.brand_name ? String(row.brand_name) : null,
    amountG: Number(row.amount_g),
    orderIndex: Number(row.order_index),
    nutrition,
  };
}

export function mapRecipe(row: NutritionRow, ingredients: NutritionRecipeIngredient[], nutritionTotal: NutritionMacroValues, nutritionPerServing: NutritionMacroValues, totalWeightG: number): NutritionRecipe {
  return {
    id: String(row.id),
    name: String(row.name),
    note: String(row.note ?? ''),
    servings: Number(row.servings),
    totalWeightG,
    nutritionPerServing,
    nutritionTotal,
    ingredients,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapDiaryItem(row: NutritionRow, nutrition: NutritionMacroValues): NutritionDiaryItem {
  return {
    id: String(row.id),
    itemType: row.item_type === 'recipe' ? 'recipe' : 'food',
    itemId: String(row.item_id),
    name: String(row.item_name),
    brandName: row.brand_name ? String(row.brand_name) : null,
    quantity: Number(row.quantity),
    unit: row.unit === 'serving' ? 'serving' : 'gram',
    amountG: Number(row.amount_g),
    servingId: row.serving_id ? String(row.serving_id) : null,
    servingLabel: row.serving_label ? String(row.serving_label) : null,
    nutrition,
  };
}

export function mapDiaryEntry(row: NutritionRow, items: NutritionDiaryItem[], nutritionTotal: NutritionMacroValues): NutritionDiaryEntry {
  return {
    id: String(row.id),
    loggedAt: String(row.logged_at),
    note: String(row.note ?? ''),
    nutritionTotal,
    items,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function mapGoals(row: NutritionRow | undefined, fallbackUpdatedAt: string): NutritionGoals {
  return {
    caloriesTarget: Number(row?.calories_target ?? 2200),
    proteinTargetG: Number(row?.protein_target_g ?? 160),
    carbsTargetG: Number(row?.carbs_target_g ?? 220),
    fatTargetG: Number(row?.fat_target_g ?? 70),
    updatedAt: row?.updated_at ? String(row.updated_at) : fallbackUpdatedAt,
  };
}
