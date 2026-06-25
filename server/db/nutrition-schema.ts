import type BetterSqlite3 from 'better-sqlite3';

export function ensureNutritionSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS nutrition_foods (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      name TEXT NOT NULL,
      brand_name TEXT,
      barcode_text TEXT,
      servings_json TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_g_per_100g REAL NOT NULL,
      carbs_g_per_100g REAL NOT NULL,
      fat_g_per_100g REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_id, source_type, name, brand_name)
    );

    CREATE TABLE IF NOT EXISTS nutrition_recipes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      note TEXT NOT NULL,
      servings REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      amount_g REAL NOT NULL,
      order_index INTEGER NOT NULL,
      FOREIGN KEY (recipe_id) REFERENCES nutrition_recipes(id) ON DELETE CASCADE,
      FOREIGN KEY (food_id) REFERENCES nutrition_foods(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS nutrition_diary_entries (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_diary_items (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      amount_g REAL NOT NULL,
      serving_id TEXT,
      serving_label TEXT,
      FOREIGN KEY (entry_id) REFERENCES nutrition_diary_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS nutrition_goals (
      owner_id TEXT PRIMARY KEY,
      calories_target REAL NOT NULL,
      protein_target_g REAL NOT NULL,
      carbs_target_g REAL NOT NULL,
      fat_target_g REAL NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_usage_stats (
      owner_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      use_count INTEGER NOT NULL,
      last_used_at TEXT NOT NULL,
      morning_count INTEGER NOT NULL,
      midday_count INTEGER NOT NULL,
      evening_count INTEGER NOT NULL,
      latenight_count INTEGER NOT NULL,
      PRIMARY KEY (owner_id, item_type, item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_nutrition_foods_owner_name ON nutrition_foods(owner_id, name);
    CREATE INDEX IF NOT EXISTS idx_nutrition_foods_owner_brand ON nutrition_foods(owner_id, brand_name, name);
    CREATE INDEX IF NOT EXISTS idx_nutrition_recipes_owner_updated ON nutrition_recipes(owner_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_ingredients_recipe ON nutrition_recipe_ingredients(recipe_id, order_index, id);
    CREATE INDEX IF NOT EXISTS idx_nutrition_diary_entries_owner_logged ON nutrition_diary_entries(owner_id, logged_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_nutrition_diary_items_entry ON nutrition_diary_items(entry_id, id);
  `);
}
