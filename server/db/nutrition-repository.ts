import crypto from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import type { NutritionDiaryEntryInput, NutritionDiaryItemInput, NutritionFoodInput, NutritionGoalsInput, NutritionRecipeInput, NutritionSearchItem } from '../../shared/nutrition-contract';
import { getDatabase } from './database';
import { addMacros, resolveAmountG, roundNutrition, scaleMacros, scaleMacrosPer100g, timeSlotForIso, zeroMacros } from './nutrition-calculations';
import { localNutritionOwnerId, mapDiaryEntry, mapDiaryItem, mapFood, mapGoals, mapRecipe, mapRecipeIngredient, type NutritionRow } from './nutrition-mappers';
import { rankSearchItems } from './nutrition-search';
import { nutritionSeedFoods } from './nutrition-seed';

function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function dateKey(isoText: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date(isoText)); }

export function createNutritionRepository(database: BetterSqlite3.Database = getDatabase(), getNow = now) {
  const owner = localNutritionOwnerId;

  const foodById = (foodId: string) => {
    const row = database.prepare('SELECT * FROM nutrition_foods WHERE owner_id = ? AND id = ?').get(owner, foodId) as NutritionRow | undefined;
    return row ? mapFood(row) : null;
  };

  const recipeRowById = (recipeId: string) =>
    database.prepare('SELECT * FROM nutrition_recipes WHERE owner_id = ? AND id = ?').get(owner, recipeId) as NutritionRow | undefined;

  const recipeIngredients = (recipeId: string) => (database.prepare(`
    SELECT ri.*, f.name AS food_name, f.source_type AS food_source_type, f.brand_name, f.calories_per_100g, f.protein_g_per_100g, f.carbs_g_per_100g, f.fat_g_per_100g
    FROM nutrition_recipe_ingredients ri JOIN nutrition_foods f ON f.id = ri.food_id
    WHERE ri.recipe_id = ? ORDER BY ri.order_index, ri.id
  `).all(recipeId) as NutritionRow[]).map((row) => mapRecipeIngredient(row, scaleMacrosPer100g({
    calories: Number(row.calories_per_100g), proteinG: Number(row.protein_g_per_100g), carbsG: Number(row.carbs_g_per_100g), fatG: Number(row.fat_g_per_100g),
  }, Number(row.amount_g))));

  const recipeById = (recipeId: string) => {
    const row = recipeRowById(recipeId);
    if (!row) return null;
    const ingredients = recipeIngredients(recipeId);
    const nutritionTotal = ingredients.reduce((sum, ingredient) => addMacros(sum, ingredient.nutrition), zeroMacros());
    const totalWeightG = ingredients.reduce((sum, ingredient) => sum + ingredient.amountG, 0);
    return mapRecipe(row, ingredients, nutritionTotal, scaleMacros(nutritionTotal, 1 / Math.max(Number(row.servings), 1)), totalWeightG);
  };

  const listRecipes = () => (database.prepare('SELECT * FROM nutrition_recipes WHERE owner_id = ? ORDER BY updated_at DESC, id DESC').all(owner) as NutritionRow[])
    .map((row) => recipeById(String(row.id))).filter(Boolean);

  const listDiaryEntries = (selectedDate: string) => (database.prepare('SELECT * FROM nutrition_diary_entries WHERE owner_id = ? ORDER BY logged_at DESC, id DESC').all(owner) as NutritionRow[])
    .filter((row) => dateKey(String(row.logged_at)) === selectedDate).map((row) => {
      const items = (database.prepare('SELECT * FROM nutrition_diary_items WHERE entry_id = ? ORDER BY id').all(String(row.id)) as NutritionRow[]).map((itemRow) => {
        if (itemRow.item_type === 'recipe') {
          const recipe = recipeById(String(itemRow.item_id));
          if (!recipe) throw new Error('Recipe was not found.');
          const nutrition = itemRow.unit === 'serving'
            ? roundNutrition({ calories: recipe.nutritionPerServing.calories * Number(itemRow.quantity), proteinG: recipe.nutritionPerServing.proteinG * Number(itemRow.quantity), carbsG: recipe.nutritionPerServing.carbsG * Number(itemRow.quantity), fatG: recipe.nutritionPerServing.fatG * Number(itemRow.quantity) })
            : scaleMacrosPer100g(recipe.nutritionTotal, Number(itemRow.amount_g) / Math.max(recipe.totalWeightG, 1) * 100);
          return mapDiaryItem({ ...itemRow, item_name: recipe.name, brand_name: null }, nutrition);
        }
        const food = foodById(String(itemRow.item_id));
        if (!food) throw new Error('Food was not found.');
        return mapDiaryItem({ ...itemRow, item_name: food.name, brand_name: food.brandName }, scaleMacrosPer100g(food.nutritionPer100g, Number(itemRow.amount_g)));
      });
      return mapDiaryEntry(row, items, items.reduce((sum, item) => addMacros(sum, item.nutrition), zeroMacros()));
    });

  const rebuildUsageStats = () => {
    database.prepare('DELETE FROM nutrition_usage_stats WHERE owner_id = ?').run(owner);
    const rows = database.prepare(`
      SELECT di.item_type, di.item_id, de.logged_at FROM nutrition_diary_items di
      JOIN nutrition_diary_entries de ON de.id = di.entry_id WHERE de.owner_id = ?
    `).all(owner) as NutritionRow[];
    const aggregate = new Map<string, Record<string, number | string>>();
    rows.forEach((row) => {
      const key = `${row.item_type}:${row.item_id}`;
      const slot = `${timeSlotForIso(String(row.logged_at))}_count`;
      const current = aggregate.get(key) ?? { owner_id: owner, item_type: String(row.item_type), item_id: String(row.item_id), use_count: 0, last_used_at: String(row.logged_at), morning_count: 0, midday_count: 0, evening_count: 0, latenight_count: 0 };
      current.use_count = Number(current.use_count) + 1;
      current.last_used_at = String(current.last_used_at) > String(row.logged_at) ? String(current.last_used_at) : String(row.logged_at);
      current[slot] = Number(current[slot] ?? 0) + 1;
      aggregate.set(key, current);
    });
    const insert = database.prepare('INSERT INTO nutrition_usage_stats (owner_id, item_type, item_id, use_count, last_used_at, morning_count, midday_count, evening_count, latenight_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    aggregate.forEach((row) => insert.run(row.owner_id, row.item_type, row.item_id, row.use_count, row.last_used_at, row.morning_count, row.midday_count, row.evening_count, row.latenight_count));
  };

  const saveDiaryItems = (entryId: string, items: NutritionDiaryItemInput[]) => {
    database.prepare('DELETE FROM nutrition_diary_items WHERE entry_id = ?').run(entryId);
    const insert = database.prepare('INSERT INTO nutrition_diary_items (id, entry_id, item_type, item_id, quantity, unit, amount_g, serving_id, serving_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    items.forEach((item) => {
      if (item.itemType === 'recipe') {
        const recipe = recipeById(item.itemId);
        if (!recipe) throw new Error(`Recipe "${item.itemId}" was not found.`);
        const amountG = item.unit === 'gram' ? item.quantity : recipe.totalWeightG / Math.max(recipe.servings, 1) * item.quantity;
        insert.run(id('ndi'), entryId, item.itemType, item.itemId, item.quantity, item.unit, amountG, item.servingId ?? null, item.unit === 'serving' ? '1 serving' : 'gram');
        return;
      }
      const food = foodById(item.itemId);
      if (!food) throw new Error(`Food "${item.itemId}" was not found.`);
      const serving = item.servingId ? food.servings.find((candidate) => candidate.id === item.servingId) ?? food.servings[0] ?? null : food.servings[0] ?? null;
      insert.run(id('ndi'), entryId, item.itemType, item.itemId, item.quantity, item.unit, resolveAmountG(food, item.quantity, item.unit, item.servingId), serving?.id ?? null, item.unit === 'serving' ? serving?.label ?? '1 serving' : 'gram');
    });
  };

  const entryInputById = (entryId: string) => {
    const entry = database.prepare('SELECT * FROM nutrition_diary_entries WHERE owner_id = ? AND id = ?').get(owner, entryId) as NutritionRow | undefined;
    if (!entry) return null;
    const items = (database.prepare('SELECT * FROM nutrition_diary_items WHERE entry_id = ? ORDER BY id').all(entryId) as NutritionRow[]).map((row) => ({
      itemType: row.item_type === 'recipe' ? 'recipe' : 'food',
      itemId: String(row.item_id),
      quantity: Number(row.quantity),
      unit: row.unit === 'serving' ? 'serving' : 'gram',
      servingId: row.serving_id ? String(row.serving_id) : null,
    }));
    return { loggedAt: String(entry.logged_at), note: String(entry.note ?? ''), items };
  };

  return {
    ensureDefaults() {
      const createdAt = getNow();
      const insertFood = database.prepare(`
        INSERT OR IGNORE INTO nutrition_foods (id, owner_id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
        VALUES (?, ?, 'whole', ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)
      `);
      nutritionSeedFoods.forEach((food) => insertFood.run(food.id, owner, food.name, JSON.stringify(food.servings), food.nutrition.calories, food.nutrition.proteinG, food.nutrition.carbsG, food.nutrition.fatG, createdAt, createdAt));
      database.prepare('INSERT OR IGNORE INTO nutrition_goals (owner_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, updated_at) VALUES (?, 2200, 160, 220, 70, ?)').run(owner, createdAt);
    },
    bootstrap(selectedDate: string) {
      this.ensureDefaults();
      const recentItemNames = (database.prepare(`
        SELECT DISTINCT CASE WHEN di.item_type = 'recipe' THEN r.name ELSE f.name END AS item_name
        FROM nutrition_diary_items di
        JOIN nutrition_diary_entries de ON de.id = di.entry_id
        LEFT JOIN nutrition_foods f ON f.id = di.item_id AND di.item_type = 'food'
        LEFT JOIN nutrition_recipes r ON r.id = di.item_id AND di.item_type = 'recipe'
        WHERE de.owner_id = ? ORDER BY de.logged_at DESC LIMIT 6
      `).all(owner) as NutritionRow[]).map((row) => String(row.item_name));
      return { selectedDate, goals: this.getGoals(), entries: listDiaryEntries(selectedDate), recipes: listRecipes(), recentItemNames };
    },
    searchItems(query: string, loggedAt: string, limit = 20): NutritionSearchItem[] {
      this.ensureDefaults();
      const foods = (database.prepare('SELECT * FROM nutrition_foods WHERE owner_id = ? ORDER BY source_type, name').all(owner) as NutritionRow[]).map(mapFood);
      const recipes = listRecipes();
      const usageRows = database.prepare('SELECT * FROM nutrition_usage_stats WHERE owner_id = ?').all(owner) as Array<{ item_type: string; item_id: string; use_count: number; last_used_at: string; morning_count: number; midday_count: number; evening_count: number; latenight_count: number }>;
      return rankSearchItems([
        ...foods.map((food) => ({ id: food.id, itemType: 'food' as const, name: food.name, brandName: food.brandName, subtitle: food.sourceType === 'brand' ? `${food.brandName ?? 'Brand'} food` : 'Whole food', defaultAmountG: food.servings[0]?.grams ?? 100, defaultServingId: food.servings[0]?.id ?? null, defaultServingLabel: food.servings[0]?.label ?? null, nutrition: scaleMacrosPer100g(food.nutritionPer100g, food.servings[0]?.grams ?? 100) })),
        ...recipes.map((recipe) => ({ id: recipe.id, itemType: 'recipe' as const, name: recipe.name, brandName: null, subtitle: `${recipe.ingredients.length} ingredients`, defaultAmountG: recipe.totalWeightG / Math.max(recipe.servings, 1), defaultServingId: null, defaultServingLabel: '1 serving', nutrition: recipe.nutritionPerServing })),
      ], usageRows, query, loggedAt).slice(0, limit);
    },
    saveBrandFood(foodId: string | null, input: NutritionFoodInput) {
      const nextId = foodId ?? id('food');
      const createdAt = foodId ? String((database.prepare('SELECT created_at FROM nutrition_foods WHERE owner_id = ? AND id = ?').get(owner, foodId) as NutritionRow | undefined)?.created_at ?? getNow()) : getNow();
      database.prepare(`
        INSERT INTO nutrition_foods (id, owner_id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
        VALUES (?, ?, 'brand', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, brand_name = excluded.brand_name, barcode_text = excluded.barcode_text, servings_json = excluded.servings_json, calories_per_100g = excluded.calories_per_100g, protein_g_per_100g = excluded.protein_g_per_100g, carbs_g_per_100g = excluded.carbs_g_per_100g, fat_g_per_100g = excluded.fat_g_per_100g, updated_at = excluded.updated_at
      `).run(nextId, owner, input.name, input.brandName ?? null, input.barcodeText ?? null, JSON.stringify(input.servings), input.nutritionPer100g.calories, input.nutritionPer100g.proteinG, input.nutritionPer100g.carbsG, input.nutritionPer100g.fatG, createdAt, getNow());
      return foodById(nextId)!;
    },
    saveRecipe(recipeId: string | null, input: NutritionRecipeInput) {
      input.ingredients.forEach((ingredient) => { if (!foodById(ingredient.foodId)) throw new Error(`Food "${ingredient.foodId}" was not found.`); });
      const nextId = recipeId ?? id('recipe');
      const createdAt = recipeId ? String((recipeRowById(recipeId)?.created_at ?? getNow())) : getNow();
      const insertIngredient = database.prepare('INSERT INTO nutrition_recipe_ingredients (id, recipe_id, food_id, amount_g, order_index) VALUES (?, ?, ?, ?, ?)');
      database.transaction(() => {
        database.prepare('INSERT INTO nutrition_recipes (id, owner_id, name, note, servings, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, note = excluded.note, servings = excluded.servings, updated_at = excluded.updated_at').run(nextId, owner, input.name, input.note ?? '', input.servings, createdAt, getNow());
        database.prepare('DELETE FROM nutrition_recipe_ingredients WHERE recipe_id = ?').run(nextId);
        input.ingredients.forEach((ingredient, index) => insertIngredient.run(id('nri'), nextId, ingredient.foodId, ingredient.amountG, ingredient.orderIndex ?? index));
      })();
      return recipeById(nextId)!;
    },
    saveDiaryEntry(entryId: string | null, input: NutritionDiaryEntryInput) {
      const nextId = entryId ?? id('nde');
      const createdAt = entryId ? String((database.prepare('SELECT created_at FROM nutrition_diary_entries WHERE owner_id = ? AND id = ?').get(owner, entryId) as NutritionRow | undefined)?.created_at ?? getNow()) : getNow();
      database.transaction(() => {
        database.prepare('INSERT INTO nutrition_diary_entries (id, owner_id, logged_at, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET logged_at = excluded.logged_at, note = excluded.note, updated_at = excluded.updated_at').run(nextId, owner, input.loggedAt, input.note ?? '', createdAt, getNow());
        saveDiaryItems(nextId, input.items);
        rebuildUsageStats();
      })();
      return listDiaryEntries(dateKey(input.loggedAt)).find((entry) => entry.id === nextId)!;
    },
    addDiaryItem(entryId: string, item: NutritionDiaryItemInput) {
      const entry = entryInputById(entryId);
      if (!entry) return null;
      return this.saveDiaryEntry(entryId, { ...entry, items: [...entry.items, item] });
    },
    updateDiaryItem(entryId: string, itemId: string, item: NutritionDiaryItemInput) {
      const entry = entryInputById(entryId);
      if (!entry) return null;
      const rows = (database.prepare('SELECT id FROM nutrition_diary_items WHERE entry_id = ? ORDER BY id').all(entryId) as NutritionRow[]).map((row) => String(row.id));
      return this.saveDiaryEntry(entryId, { ...entry, items: entry.items.map((current, index) => rows[index] === itemId ? item : current) });
    },
    deleteDiaryEntry(entryId: string) {
      const changed = database.prepare('DELETE FROM nutrition_diary_entries WHERE owner_id = ? AND id = ?').run(owner, entryId).changes > 0;
      rebuildUsageStats();
      return changed;
    },
    deleteDiaryItem(entryId: string, itemId: string) {
      const entry = entryInputById(entryId);
      if (!entry) return false;
      const rows = (database.prepare('SELECT id FROM nutrition_diary_items WHERE entry_id = ? ORDER BY id').all(entryId) as NutritionRow[]).map((row) => String(row.id));
      const items = entry.items.filter((_, index) => rows[index] !== itemId);
      if (!items.length) return this.deleteDiaryEntry(entryId);
      this.saveDiaryEntry(entryId, { ...entry, items });
      return true;
    },
    getGoals() {
      this.ensureDefaults();
      return mapGoals(database.prepare('SELECT * FROM nutrition_goals WHERE owner_id = ?').get(owner) as NutritionRow | undefined, getNow());
    },
    saveGoals(input: NutritionGoalsInput) {
      database.prepare('INSERT INTO nutrition_goals (owner_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id) DO UPDATE SET calories_target = excluded.calories_target, protein_target_g = excluded.protein_target_g, carbs_target_g = excluded.carbs_target_g, fat_target_g = excluded.fat_target_g, updated_at = excluded.updated_at').run(owner, input.caloriesTarget, input.proteinTargetG, input.carbsTargetG, input.fatTargetG, getNow());
      return this.getGoals();
    },
  };
}

export const nutritionRepository = createNutritionRepository();
