import {
  appendNutritionEntryItem,
  createNutritionBrandFood,
  createNutritionEntry,
  createNutritionRecipe,
  deleteNutritionEntry,
  deleteNutritionEntryItem,
  fetchNutritionBootstrap,
  fetchNutritionGoals,
  fetchNutritionHistory,
  fetchNutritionRecipes,
  saveNutritionGoals,
  searchNutritionItems,
  updateNutritionBrandFood,
  updateNutritionEntry,
  updateNutritionEntryItem,
  updateNutritionRecipe,
} from '../../nutrition/nutrition-api';
import { nutritionToolDefinition } from './nutrition-tool-definition';
import { parseEntryArg, parseFoodArg, parseGoalsArg, parseHistoryArgs, parseItemArg, parseOverviewArgs, parseRecipeArg, parseSearchArgs, requiredString } from './nutrition-tool-parsers';
import type { ToolRegistryEntry, ToolResult } from './types';

function result(toolId: string, functionName: string, summary: string, data: Record<string, unknown> = {}): ToolResult {
  return { toolId, functionName, ok: true, summary, data };
}

function error(toolId: string, functionName: string, message: string): ToolResult {
  return { toolId, functionName, ok: false, summary: message, error: message };
}

function summarizeCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

async function executeNutritionFunction(functionName: string, args: Record<string, unknown>, toolId: string) {
  if (functionName === 'get_nutrition_overview') {
    const { date } = parseOverviewArgs(args);
    const overview = await fetchNutritionBootstrap(date);
    return result(toolId, functionName, `Loaded nutrition overview for ${overview.selectedDate} with ${summarizeCount(overview.entries.length, 'entry')} and ${summarizeCount(overview.recipes.length, 'recipe')}.`, overview as unknown as Record<string, unknown>);
  }
  if (functionName === 'search_nutrition_items') {
    const input = parseSearchArgs(args);
    const items = await searchNutritionItems(input.query, input.loggedAt);
    return result(toolId, functionName, `Found ${summarizeCount(items.length, 'nutrition item')} matching the search.`, { items });
  }
  if (functionName === 'get_nutrition_history') {
    const input = parseHistoryArgs(args);
    const entries = await fetchNutritionHistory(input);
    const label = input.date ? input.date : `${input.startDate} through ${input.endDate}`;
    return result(toolId, functionName, `Loaded ${summarizeCount(entries.length, 'nutrition entry')} from ${label}.`, { entries });
  }
  if (functionName === 'create_nutrition_brand_food') {
    const item = await createNutritionBrandFood(parseFoodArg(args));
    return result(toolId, functionName, `Created nutrition food "${item.name}".`, { item });
  }
  if (functionName === 'update_nutrition_brand_food') {
    const item = await updateNutritionBrandFood(requiredString(args, 'foodId'), parseFoodArg(args));
    return result(toolId, functionName, `Updated nutrition food "${item.name}".`, { item });
  }
  if (functionName === 'list_nutrition_recipes') {
    const items = await fetchNutritionRecipes();
    return result(toolId, functionName, `Loaded ${summarizeCount(items.length, 'nutrition recipe')}.`, { items });
  }
  if (functionName === 'create_nutrition_recipe') {
    const item = await createNutritionRecipe(parseRecipeArg(args));
    return result(toolId, functionName, `Created nutrition recipe "${item.name}".`, { item });
  }
  if (functionName === 'update_nutrition_recipe') {
    const item = await updateNutritionRecipe(requiredString(args, 'recipeId'), parseRecipeArg(args));
    return result(toolId, functionName, `Updated nutrition recipe "${item.name}".`, { item });
  }
  if (functionName === 'get_nutrition_goals') {
    const item = await fetchNutritionGoals();
    return result(toolId, functionName, 'Loaded nutrition goals.', { item });
  }
  if (functionName === 'update_nutrition_goals') {
    const item = await saveNutritionGoals(parseGoalsArg(args));
    return result(toolId, functionName, 'Updated nutrition goals.', { item });
  }
  if (functionName === 'create_nutrition_entry') {
    const item = await createNutritionEntry(parseEntryArg(args));
    return result(toolId, functionName, `Created nutrition entry "${item.id}".`, { item });
  }
  if (functionName === 'update_nutrition_entry') {
    const item = await updateNutritionEntry(requiredString(args, 'entryId'), parseEntryArg(args));
    return result(toolId, functionName, `Updated nutrition entry "${item.id}".`, { item });
  }
  if (functionName === 'delete_nutrition_entry') {
    const entryId = requiredString(args, 'entryId');
    await deleteNutritionEntry(entryId);
    return result(toolId, functionName, `Deleted nutrition entry "${entryId}".`, { entryId });
  }
  if (functionName === 'append_nutrition_entry_item') {
    const item = await appendNutritionEntryItem(requiredString(args, 'entryId'), parseItemArg(args));
    return result(toolId, functionName, `Added an item to nutrition entry "${item.id}".`, { item });
  }
  if (functionName === 'update_nutrition_entry_item') {
    const item = await updateNutritionEntryItem(requiredString(args, 'entryId'), requiredString(args, 'itemId'), parseItemArg(args));
    return result(toolId, functionName, `Updated an item on nutrition entry "${item.id}".`, { item });
  }
  if (functionName === 'delete_nutrition_entry_item') {
    const entryId = requiredString(args, 'entryId');
    const itemId = requiredString(args, 'itemId');
    await deleteNutritionEntryItem(entryId, itemId);
    return result(toolId, functionName, `Deleted item "${itemId}" from nutrition entry "${entryId}".`, { entryId, itemId });
  }
  return error(toolId, functionName, `Unknown nutrition function "${functionName}".`);
}

export const nutritionTool: ToolRegistryEntry = {
  definition: nutritionToolDefinition,
  async execute(invocation) {
    try {
      return await executeNutritionFunction(invocation.functionName, invocation.args, invocation.toolId);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Nutrition action failed.';
      return error(invocation.toolId, invocation.functionName, message);
    }
  },
};
