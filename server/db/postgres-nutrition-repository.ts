import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { NutritionDiaryEntryInput, NutritionDiaryItemInput, NutritionFoodInput, NutritionGoalsInput, NutritionHistoryQuery, NutritionRecipeInput, NutritionSearchItem } from '../../shared/nutrition-contract';
import { addMacros, resolveAmountG, roundNutrition, scaleMacros, scaleMacrosPer100g, timeSlotForIso, zeroMacros } from './nutrition-calculations';
import { mapDiaryEntry, mapDiaryItem, mapFood, mapGoals, mapRecipe, mapRecipeIngredient, type NutritionRow } from './nutrition-mappers';
import { rankSearchItems } from './nutrition-search';
import { nutritionSeedFoods } from './nutrition-seed';
import { getPostgresPool } from './postgres';
import { assertOwnerUuid, normalizeJsonb, runPostgresTransaction, toIsoString, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

type Row = Record<string, unknown>;

function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function dateKey(isoText: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }).format(new Date(isoText)); }

function normalizeRow(row: Row): NutritionRow {
  const next: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) next[key] = toIsoString(value);
    else if (value === null) next[key] = null;
    else if (key.endsWith('_json')) next[key] = typeof value === 'string' ? value : JSON.stringify(normalizeJsonb(value));
    else next[key] = value as string | number;
  }
  return next;
}

export function createPostgresNutritionRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
  getNow = now,
) {
  const owner = assertOwnerUuid(ownerId);

  async function foodById(foodId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM nutrition_foods WHERE owner_id = $1 AND id = $2', [owner, foodId]);
    return result.rows[0] ? mapFood(normalizeRow(result.rows[0] as Row)) : null;
  }

  async function recipeRowById(recipeId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM nutrition_recipes WHERE owner_id = $1 AND id = $2', [owner, recipeId]);
    return result.rows[0] ? normalizeRow(result.rows[0] as Row) : null;
  }

  async function recipeIngredients(recipeId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query(`
      SELECT ri.*, f.name AS food_name, f.source_type AS food_source_type, f.brand_name, f.calories_per_100g, f.protein_g_per_100g, f.carbs_g_per_100g, f.fat_g_per_100g
      FROM nutrition_recipe_ingredients ri JOIN nutrition_foods f ON f.owner_id = ri.owner_id AND f.id = ri.food_id
      WHERE ri.owner_id = $1 AND ri.recipe_id = $2 ORDER BY ri.order_index, ri.id
    `, [owner, recipeId]);
    return result.rows.map((row) => {
      const normalized = normalizeRow(row as Row);
      return mapRecipeIngredient(normalized, scaleMacrosPer100g({ calories: Number(normalized.calories_per_100g), proteinG: Number(normalized.protein_g_per_100g), carbsG: Number(normalized.carbs_g_per_100g), fatG: Number(normalized.fat_g_per_100g) }, Number(normalized.amount_g)));
    });
  }

  async function recipeById(recipeId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const row = await recipeRowById(recipeId, nextExecutor);
    if (!row) return null;
    const ingredients = await recipeIngredients(recipeId, nextExecutor);
    const nutritionTotal = ingredients.reduce((sum, ingredient) => addMacros(sum, ingredient.nutrition), zeroMacros());
    const totalWeightG = ingredients.reduce((sum, ingredient) => sum + ingredient.amountG, 0);
    return mapRecipe(row, ingredients, nutritionTotal, scaleMacros(nutritionTotal, 1 / Math.max(Number(row.servings), 1)), totalWeightG);
  }

  async function listRecipes(nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM nutrition_recipes WHERE owner_id = $1 ORDER BY updated_at DESC, id DESC', [owner]);
    const recipes = [] as NonNullable<Awaited<ReturnType<typeof recipeById>>>[];
    for (const row of result.rows) {
      const recipe = await recipeById(String((row as Row).id), nextExecutor);
      if (recipe) recipes.push(recipe);
    }
    return recipes;
  }

  async function hydrateDiaryEntry(row: NutritionRow, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const itemRows = await nextExecutor.query('SELECT * FROM nutrition_diary_items WHERE owner_id = $1 AND entry_id = $2 ORDER BY id', [owner, String(row.id)]);
    const items = [] as ReturnType<typeof mapDiaryItem>[];
    for (const itemRow of itemRows.rows.map((entry) => normalizeRow(entry as Row))) {
      if (itemRow.item_type === 'recipe') {
        const recipe = await recipeById(String(itemRow.item_id), nextExecutor);
        if (!recipe) throw new Error('Recipe was not found.');
        const nutrition = itemRow.unit === 'serving'
          ? roundNutrition({ calories: recipe.nutritionPerServing.calories * Number(itemRow.quantity), proteinG: recipe.nutritionPerServing.proteinG * Number(itemRow.quantity), carbsG: recipe.nutritionPerServing.carbsG * Number(itemRow.quantity), fatG: recipe.nutritionPerServing.fatG * Number(itemRow.quantity) })
          : scaleMacrosPer100g(recipe.nutritionTotal, Number(itemRow.amount_g) / Math.max(recipe.totalWeightG, 1) * 100);
        items.push(mapDiaryItem({ ...itemRow, item_name: recipe.name, brand_name: null }, nutrition));
      } else {
        const food = await foodById(String(itemRow.item_id), nextExecutor);
        if (!food) throw new Error('Food was not found.');
        items.push(mapDiaryItem({ ...itemRow, item_name: food.name, brand_name: food.brandName }, scaleMacrosPer100g(food.nutritionPer100g, Number(itemRow.amount_g))));
      }
    }
    return mapDiaryEntry(row, items, items.reduce((sum, item) => addMacros(sum, item.nutrition), zeroMacros()));
  }

  function matchesHistory(entryDate: string, query: NutritionHistoryQuery) {
    return query.date ? entryDate === query.date : entryDate >= String(query.startDate) && entryDate <= String(query.endDate);
  }

  async function listDiaryEntries(query: NutritionHistoryQuery, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM nutrition_diary_entries WHERE owner_id = $1 ORDER BY logged_at DESC, id DESC', [owner]);
    const entries = result.rows.map((row) => normalizeRow(row as Row)).filter((row) => matchesHistory(dateKey(String(row.logged_at)), query)).slice(0, query.limit ?? Number.POSITIVE_INFINITY);
    const hydrated = [] as Awaited<ReturnType<typeof hydrateDiaryEntry>>[];
    for (const row of entries) hydrated.push(await hydrateDiaryEntry(row, nextExecutor));
    return hydrated;
  }

  async function rebuildUsageStats(nextExecutor: PostgresExecutor) {
    await nextExecutor.query('DELETE FROM nutrition_usage_stats WHERE owner_id = $1', [owner]);
    const result = await nextExecutor.query(`
      SELECT di.item_type, di.item_id, de.logged_at FROM nutrition_diary_items di
      JOIN nutrition_diary_entries de ON de.owner_id = di.owner_id AND de.id = di.entry_id WHERE di.owner_id = $1 AND de.owner_id = $1
    `, [owner]);
    const aggregate = new Map<string, Record<string, number | string>>();
    result.rows.map((row) => normalizeRow(row as Row)).forEach((row) => {
      const key = `${row.item_type}:${row.item_id}`;
      const slot = `${timeSlotForIso(String(row.logged_at))}_count`;
      const current = aggregate.get(key) ?? { item_type: String(row.item_type), item_id: String(row.item_id), use_count: 0, last_used_at: String(row.logged_at), morning_count: 0, midday_count: 0, evening_count: 0, latenight_count: 0 };
      current.use_count = Number(current.use_count) + 1;
      current.last_used_at = String(current.last_used_at) > String(row.logged_at) ? String(current.last_used_at) : String(row.logged_at);
      current[slot] = Number(current[slot] ?? 0) + 1;
      aggregate.set(key, current);
    });
    for (const row of aggregate.values()) {
      await nextExecutor.query('INSERT INTO nutrition_usage_stats (owner_id, item_type, item_id, use_count, last_used_at, morning_count, midday_count, evening_count, latenight_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [owner, row.item_type, row.item_id, row.use_count, row.last_used_at, row.morning_count, row.midday_count, row.evening_count, row.latenight_count]);
    }
  }

  async function saveDiaryItems(entryId: string, items: NutritionDiaryItemInput[], nextExecutor: PostgresExecutor) {
    await nextExecutor.query('DELETE FROM nutrition_diary_items WHERE owner_id = $1 AND entry_id = $2', [owner, entryId]);
    for (const item of items) {
      if (item.itemType === 'recipe') {
        const recipe = await recipeById(item.itemId, nextExecutor);
        if (!recipe) throw new Error(`Recipe "${item.itemId}" was not found.`);
        const amountG = item.unit === 'gram' ? item.quantity : recipe.totalWeightG / Math.max(recipe.servings, 1) * item.quantity;
        await nextExecutor.query('INSERT INTO nutrition_diary_items (owner_id, id, entry_id, item_type, item_id, quantity, unit, amount_g, serving_id, serving_label) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [owner, id('ndi'), entryId, item.itemType, item.itemId, item.quantity, item.unit, amountG, item.servingId ?? null, item.unit === 'serving' ? '1 serving' : 'gram']);
        continue;
      }
      const food = await foodById(item.itemId, nextExecutor);
      if (!food) throw new Error(`Food "${item.itemId}" was not found.`);
      const serving = item.servingId ? food.servings.find((candidate) => candidate.id === item.servingId) ?? food.servings[0] ?? null : food.servings[0] ?? null;
      await nextExecutor.query('INSERT INTO nutrition_diary_items (owner_id, id, entry_id, item_type, item_id, quantity, unit, amount_g, serving_id, serving_label) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [owner, id('ndi'), entryId, item.itemType, item.itemId, item.quantity, item.unit, resolveAmountG(food, item.quantity, item.unit, item.servingId), serving?.id ?? null, item.unit === 'serving' ? serving?.label ?? '1 serving' : 'gram']);
    }
  }

  async function entryInputById(entryId: string) {
    const entry = await (executor as PostgresExecutor).query('SELECT * FROM nutrition_diary_entries WHERE owner_id = $1 AND id = $2', [owner, entryId]);
    if (!entry.rows[0]) return null;
    const items = await (executor as PostgresExecutor).query('SELECT * FROM nutrition_diary_items WHERE owner_id = $1 AND entry_id = $2 ORDER BY id', [owner, entryId]);
    return { loggedAt: toIsoString((entry.rows[0] as Row).logged_at), note: String((entry.rows[0] as Row).note ?? ''), items: items.rows.map((raw) => {
      const row = normalizeRow(raw as Row);
      return { itemType: row.item_type === 'recipe' ? 'recipe' as const : 'food' as const, itemId: String(row.item_id), quantity: Number(row.quantity), unit: row.unit === 'serving' ? 'serving' as const : 'gram' as const, servingId: row.serving_id ? String(row.serving_id) : null };
    }) };
  }

  return {
    async ensureDefaults() {
      const createdAt = getNow();
      await runPostgresTransaction(executor, async (client) => {
        for (const food of nutritionSeedFoods) {
          await client.query(`
            INSERT INTO nutrition_foods (owner_id, id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
            VALUES ($1, $2, 'whole', $3, NULL, NULL, $4::jsonb, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (owner_id, id) DO NOTHING
          `, [owner, food.id, food.name, toJsonbParam(food.servings), food.nutrition.calories, food.nutrition.proteinG, food.nutrition.carbsG, food.nutrition.fatG, createdAt, createdAt]);
        }
        await client.query('INSERT INTO nutrition_goals (owner_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, updated_at) VALUES ($1, 2200, 160, 220, 70, $2) ON CONFLICT (owner_id) DO NOTHING', [owner, createdAt]);
      });
    },
    async bootstrap(selectedDate: string) {
      await this.ensureDefaults();
      const recent = await (executor as PostgresExecutor).query(`
        SELECT item_name FROM (
          SELECT CASE WHEN di.item_type = 'recipe' THEN r.name ELSE f.name END AS item_name, MAX(de.logged_at) AS last_logged_at
          FROM nutrition_diary_items di
          JOIN nutrition_diary_entries de ON de.owner_id = di.owner_id AND de.id = di.entry_id
          LEFT JOIN nutrition_foods f ON f.owner_id = di.owner_id AND f.id = di.item_id AND di.item_type = 'food'
          LEFT JOIN nutrition_recipes r ON r.owner_id = di.owner_id AND r.id = di.item_id AND di.item_type = 'recipe'
          WHERE di.owner_id = $1 AND de.owner_id = $1
          GROUP BY item_name
        ) recent_items WHERE item_name IS NOT NULL ORDER BY last_logged_at DESC LIMIT 6
      `, [owner]);
      return { selectedDate, goals: await this.getGoals(), entries: await listDiaryEntries({ date: selectedDate }), recipes: await listRecipes(), recentItemNames: recent.rows.map((row) => String((row as Row).item_name)) };
    },
    async listDiaryEntries(query: NutritionHistoryQuery) { await this.ensureDefaults(); return listDiaryEntries(query); },
    async searchItems(query: string, loggedAt: string, limit = 20): Promise<NutritionSearchItem[]> {
      await this.ensureDefaults();
      const foods = (await (executor as PostgresExecutor).query('SELECT * FROM nutrition_foods WHERE owner_id = $1 ORDER BY source_type, name', [owner])).rows.map((row) => mapFood(normalizeRow(row as Row)));
      const recipes = await listRecipes();
      const usageRows = (await (executor as PostgresExecutor).query('SELECT * FROM nutrition_usage_stats WHERE owner_id = $1', [owner])).rows.map((row) => normalizeRow(row as Row)) as Array<{ item_type: string; item_id: string; use_count: number; last_used_at: string; morning_count: number; midday_count: number; evening_count: number; latenight_count: number }>;
      return rankSearchItems([
        ...foods.map((food) => ({ id: food.id, itemType: 'food' as const, name: food.name, brandName: food.brandName, subtitle: food.sourceType === 'brand' ? `${food.brandName ?? 'Brand'} food` : 'Whole food', defaultAmountG: food.servings[0]?.grams ?? 100, defaultServingId: food.servings[0]?.id ?? null, defaultServingLabel: food.servings[0]?.label ?? null, nutrition: scaleMacrosPer100g(food.nutritionPer100g, food.servings[0]?.grams ?? 100) })),
        ...recipes.map((recipe) => ({ id: recipe.id, itemType: 'recipe' as const, name: recipe.name, brandName: null, subtitle: `${recipe.ingredients.length} ingredients`, defaultAmountG: recipe.totalWeightG / Math.max(recipe.servings, 1), defaultServingId: null, defaultServingLabel: '1 serving', nutrition: recipe.nutritionPerServing })),
      ], usageRows, query, loggedAt).slice(0, limit);
    },
    async saveBrandFood(foodId: string | null, input: NutritionFoodInput) {
      const nextId = foodId ?? id('food');
      const existing = foodId ? await (executor as PostgresExecutor).query('SELECT created_at FROM nutrition_foods WHERE owner_id = $1 AND id = $2', [owner, foodId]) : null;
      const createdAt = existing?.rows[0] ? toIsoString((existing.rows[0] as Row).created_at) : getNow();
      await (executor as PostgresExecutor).query(`
        INSERT INTO nutrition_foods (owner_id, id, source_type, name, brand_name, barcode_text, servings_json, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, created_at, updated_at)
        VALUES ($1, $2, 'brand', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (owner_id, id) DO UPDATE SET name = excluded.name, brand_name = excluded.brand_name, barcode_text = excluded.barcode_text, servings_json = excluded.servings_json, calories_per_100g = excluded.calories_per_100g, protein_g_per_100g = excluded.protein_g_per_100g, carbs_g_per_100g = excluded.carbs_g_per_100g, fat_g_per_100g = excluded.fat_g_per_100g, updated_at = excluded.updated_at
      `, [owner, nextId, input.name, input.brandName ?? null, input.barcodeText ?? null, toJsonbParam(input.servings), input.nutritionPer100g.calories, input.nutritionPer100g.proteinG, input.nutritionPer100g.carbsG, input.nutritionPer100g.fatG, createdAt, getNow()]);
      return (await foodById(nextId))!;
    },
    async saveRecipe(recipeId: string | null, input: NutritionRecipeInput) {
      for (const ingredient of input.ingredients) { if (!await foodById(ingredient.foodId)) throw new Error(`Food "${ingredient.foodId}" was not found.`); }
      const nextId = recipeId ?? id('recipe');
      await runPostgresTransaction(executor, async (client) => {
        const existing = recipeId ? await recipeRowById(recipeId, client) : null;
        const createdAt = existing?.created_at ? String(existing.created_at) : getNow();
        await client.query('INSERT INTO nutrition_recipes (owner_id, id, name, note, servings, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (owner_id, id) DO UPDATE SET name = excluded.name, note = excluded.note, servings = excluded.servings, updated_at = excluded.updated_at', [owner, nextId, input.name, input.note ?? '', input.servings, createdAt, getNow()]);
        await client.query('DELETE FROM nutrition_recipe_ingredients WHERE owner_id = $1 AND recipe_id = $2', [owner, nextId]);
        for (const [index, ingredient] of input.ingredients.entries()) await client.query('INSERT INTO nutrition_recipe_ingredients (owner_id, id, recipe_id, food_id, amount_g, order_index) VALUES ($1, $2, $3, $4, $5, $6)', [owner, id('nri'), nextId, ingredient.foodId, ingredient.amountG, ingredient.orderIndex ?? index]);
      });
      return (await recipeById(nextId))!;
    },
    async saveDiaryEntry(entryId: string | null, input: NutritionDiaryEntryInput) {
      const nextId = entryId ?? id('nde');
      await runPostgresTransaction(executor, async (client) => {
        const existing = entryId ? await client.query('SELECT created_at FROM nutrition_diary_entries WHERE owner_id = $1 AND id = $2', [owner, entryId]) : null;
        const createdAt = existing?.rows[0] ? toIsoString((existing.rows[0] as Row).created_at) : getNow();
        await client.query('INSERT INTO nutrition_diary_entries (owner_id, id, logged_at, note, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (owner_id, id) DO UPDATE SET logged_at = excluded.logged_at, note = excluded.note, updated_at = excluded.updated_at', [owner, nextId, input.loggedAt, input.note ?? '', createdAt, getNow()]);
        await saveDiaryItems(nextId, input.items, client);
        await rebuildUsageStats(client);
      });
      return (await listDiaryEntries({ date: dateKey(input.loggedAt) })).find((entry) => entry.id === nextId)!;
    },
    async addDiaryItem(entryId: string, item: NutritionDiaryItemInput) { const entry = await entryInputById(entryId); return entry ? this.saveDiaryEntry(entryId, { ...entry, items: [...entry.items, item] }) : null; },
    async updateDiaryItem(entryId: string, itemId: string, item: NutritionDiaryItemInput) {
      const entry = await entryInputById(entryId);
      if (!entry) return null;
      const rows = (await (executor as PostgresExecutor).query('SELECT id FROM nutrition_diary_items WHERE owner_id = $1 AND entry_id = $2 ORDER BY id', [owner, entryId])).rows.map((row) => String((row as Row).id));
      return this.saveDiaryEntry(entryId, { ...entry, items: entry.items.map((current, index) => rows[index] === itemId ? item : current) });
    },
    async deleteDiaryEntry(entryId: string) {
      return runPostgresTransaction(executor, async (client) => {
        const result = await client.query('DELETE FROM nutrition_diary_entries WHERE owner_id = $1 AND id = $2', [owner, entryId]);
        await rebuildUsageStats(client);
        return (result.rowCount ?? 0) > 0;
      });
    },
    async deleteDiaryItem(entryId: string, itemId: string) {
      const entry = await entryInputById(entryId);
      if (!entry) return false;
      const rows = (await (executor as PostgresExecutor).query('SELECT id FROM nutrition_diary_items WHERE owner_id = $1 AND entry_id = $2 ORDER BY id', [owner, entryId])).rows.map((row) => String((row as Row).id));
      const items = entry.items.filter((_, index) => rows[index] !== itemId);
      if (!items.length) return this.deleteDiaryEntry(entryId);
      await this.saveDiaryEntry(entryId, { ...entry, items });
      return true;
    },
    async getGoals() { await this.ensureDefaults(); const result = await (executor as PostgresExecutor).query('SELECT * FROM nutrition_goals WHERE owner_id = $1', [owner]); return mapGoals(result.rows[0] ? normalizeRow(result.rows[0] as Row) : undefined, getNow()); },
    async saveGoals(input: NutritionGoalsInput) {
      await (executor as PostgresExecutor).query('INSERT INTO nutrition_goals (owner_id, calories_target, protein_target_g, carbs_target_g, fat_target_g, updated_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (owner_id) DO UPDATE SET calories_target = excluded.calories_target, protein_target_g = excluded.protein_target_g, carbs_target_g = excluded.carbs_target_g, fat_target_g = excluded.fat_target_g, updated_at = excluded.updated_at', [owner, input.caloriesTarget, input.proteinTargetG, input.carbsTargetG, input.fatTargetG, getNow()]);
      return this.getGoals();
    },
  };
}
