import type { ToolDefinition } from './types';

export const nutritionToolDefinition: ToolDefinition = {
  id: 'nutrition',
  label: 'Nutrition',
  alias: '/nutrition',
  description: [
    'Reads and writes the local nutrition module, including goals, foods, recipes, diary entries, and diary history.',
    'Use exact dates in YYYY-MM-DD for history. Read before writing when ids are unknown.',
  ].join(' '),
  enabledByDefault: true,
  functions: [
    { name: 'get_nutrition_overview', description: 'Load nutrition goals, recipes, recent item names, and diary entries for a selected day.', parameters: [{ name: 'date', type: 'string', description: 'Optional YYYY-MM-DD date. Defaults to today.' }] },
    { name: 'search_nutrition_items', description: 'Search foods and recipes for meal logging.', parameters: [{ name: 'query', type: 'string', description: 'Optional search text.' }, { name: 'loggedAt', type: 'string', description: 'Optional ISO timestamp for time-of-day ranking.' }] },
    { name: 'get_nutrition_history', description: 'Load diary history for either one exact date or an inclusive date range.', parameters: [{ name: 'date', type: 'string', description: 'Exact YYYY-MM-DD date.' }, { name: 'startDate', type: 'string', description: 'Range start YYYY-MM-DD.' }, { name: 'endDate', type: 'string', description: 'Range end YYYY-MM-DD.' }, { name: 'limit', type: 'number', description: 'Optional max results, default 20.' }] },
    { name: 'create_nutrition_brand_food', description: 'Create a branded food from a NutritionFoodInput object.', parameters: [{ name: 'food', type: 'object', description: 'NutritionFoodInput object.', required: true }] },
    { name: 'update_nutrition_brand_food', description: 'Update an existing branded food.', parameters: [{ name: 'foodId', type: 'string', description: 'Food id.', required: true }, { name: 'food', type: 'object', description: 'NutritionFoodInput object.', required: true }] },
    { name: 'list_nutrition_recipes', description: 'List nutrition recipes.', parameters: [] },
    { name: 'create_nutrition_recipe', description: 'Create a recipe from a NutritionRecipeInput object.', parameters: [{ name: 'recipe', type: 'object', description: 'NutritionRecipeInput object.', required: true }] },
    { name: 'update_nutrition_recipe', description: 'Update an existing recipe.', parameters: [{ name: 'recipeId', type: 'string', description: 'Recipe id.', required: true }, { name: 'recipe', type: 'object', description: 'NutritionRecipeInput object.', required: true }] },
    { name: 'get_nutrition_goals', description: 'Load nutrition goals.', parameters: [] },
    { name: 'update_nutrition_goals', description: 'Replace nutrition goals from a NutritionGoalsInput object.', parameters: [{ name: 'goals', type: 'object', description: 'NutritionGoalsInput object.', required: true }] },
    { name: 'create_nutrition_entry', description: 'Create a diary entry from a NutritionDiaryEntryInput object.', parameters: [{ name: 'entry', type: 'object', description: 'NutritionDiaryEntryInput object.', required: true }] },
    { name: 'update_nutrition_entry', description: 'Update an existing diary entry.', parameters: [{ name: 'entryId', type: 'string', description: 'Diary entry id.', required: true }, { name: 'entry', type: 'object', description: 'NutritionDiaryEntryInput object.', required: true }] },
    { name: 'delete_nutrition_entry', description: 'Delete a diary entry by id.', parameters: [{ name: 'entryId', type: 'string', description: 'Diary entry id.', required: true }] },
    { name: 'append_nutrition_entry_item', description: 'Append one item to an existing diary entry.', parameters: [{ name: 'entryId', type: 'string', description: 'Diary entry id.', required: true }, { name: 'item', type: 'object', description: 'NutritionDiaryItemInput object.', required: true }] },
    { name: 'update_nutrition_entry_item', description: 'Replace one item on an existing diary entry.', parameters: [{ name: 'entryId', type: 'string', description: 'Diary entry id.', required: true }, { name: 'itemId', type: 'string', description: 'Diary item id.', required: true }, { name: 'item', type: 'object', description: 'NutritionDiaryItemInput object.', required: true }] },
    { name: 'delete_nutrition_entry_item', description: 'Delete one item from a diary entry.', parameters: [{ name: 'entryId', type: 'string', description: 'Diary entry id.', required: true }, { name: 'itemId', type: 'string', description: 'Diary item id.', required: true }] },
  ],
};
