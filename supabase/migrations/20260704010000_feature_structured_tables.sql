CREATE TABLE IF NOT EXISTS calendar_calendars (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  trashed_at timestamptz,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS calendar_categories (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  calendar_id text NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  trashed_at timestamptz,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, calendar_id) REFERENCES calendar_calendars(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_events (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  calendar_id text NOT NULL,
  category_id text,
  title text NOT NULL,
  notes text NOT NULL,
  location text NOT NULL,
  timezone text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  all_day boolean NOT NULL,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  trashed_at timestamptz,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, calendar_id) REFERENCES calendar_calendars(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, category_id) REFERENCES calendar_categories(owner_id, id) ON DELETE SET NULL (category_id)
);

CREATE TABLE IF NOT EXISTS calendar_recurrence_rules (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  target_kind text NOT NULL,
  target_id text NOT NULL,
  frequency text NOT NULL,
  interval_count integer NOT NULL,
  count_limit integer,
  until_at timestamptz,
  by_weekday_json jsonb NOT NULL,
  rrule_text text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS calendar_recurrence_exceptions (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  event_id text NOT NULL,
  occurrence_key text NOT NULL,
  action text NOT NULL,
  override_json jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, event_id, occurrence_key),
  FOREIGN KEY (owner_id, event_id) REFERENCES calendar_events(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_tasks (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  category_id text,
  title text NOT NULL,
  notes text NOT NULL,
  due_at timestamptz,
  due_date date,
  timezone text NOT NULL,
  priority text NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  trashed_at timestamptz,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, category_id) REFERENCES calendar_categories(owner_id, id) ON DELETE SET NULL (category_id)
);

CREATE TABLE IF NOT EXISTS calendar_task_recurrence_rules (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  task_id text NOT NULL,
  frequency text NOT NULL,
  interval_count integer NOT NULL,
  count_limit integer,
  until_at timestamptz,
  by_weekday_json jsonb NOT NULL,
  rrule_text text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, task_id) REFERENCES calendar_tasks(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS calendar_settings (
  owner_id uuid NOT NULL PRIMARY KEY,
  timezone text NOT NULL,
  week_start text NOT NULL,
  hour_cycle text NOT NULL,
  working_hours_start text NOT NULL,
  working_hours_end text NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_undo_actions (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  action_kind text NOT NULL,
  entity_kind text NOT NULL,
  entity_id text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  equipment text NOT NULL,
  is_preset boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS workout_routines (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  archived_at timestamptz,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS workout_routine_exercises (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  routine_id text NOT NULL,
  exercise_id text NOT NULL,
  order_index integer NOT NULL,
  target_sets integer NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, routine_id) REFERENCES workout_routines(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, exercise_id) REFERENCES workout_exercises(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  routine_id text,
  name text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS workout_session_exercises (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  session_id text NOT NULL,
  exercise_id text NOT NULL,
  order_index integer NOT NULL,
  notes text NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, session_id) REFERENCES workout_sessions(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, exercise_id) REFERENCES workout_exercises(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workout_sets (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  session_exercise_id text NOT NULL,
  set_index integer NOT NULL,
  rir numeric(8, 3),
  reps numeric(8, 3),
  weight numeric(10, 3),
  completed boolean NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, session_exercise_id) REFERENCES workout_session_exercises(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nutrition_foods (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  source_type text NOT NULL,
  name text NOT NULL,
  brand_name text,
  barcode_text text,
  servings_json jsonb NOT NULL,
  calories_per_100g numeric(12, 4) NOT NULL,
  protein_g_per_100g numeric(12, 4) NOT NULL,
  carbs_g_per_100g numeric(12, 4) NOT NULL,
  fat_g_per_100g numeric(12, 4) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id),
  UNIQUE (owner_id, source_type, name, brand_name)
);

CREATE TABLE IF NOT EXISTS nutrition_recipes (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  name text NOT NULL,
  note text NOT NULL,
  servings numeric(10, 3) NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS nutrition_recipe_ingredients (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  recipe_id text NOT NULL,
  food_id text NOT NULL,
  amount_g numeric(12, 4) NOT NULL,
  order_index integer NOT NULL,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, recipe_id) REFERENCES nutrition_recipes(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, food_id) REFERENCES nutrition_foods(owner_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS nutrition_diary_entries (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  logged_at timestamptz NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (owner_id, id)
);

CREATE TABLE IF NOT EXISTS nutrition_diary_items (
  owner_id uuid NOT NULL,
  id text NOT NULL,
  entry_id text NOT NULL,
  item_type text NOT NULL,
  item_id text NOT NULL,
  quantity numeric(12, 4) NOT NULL,
  unit text NOT NULL,
  amount_g numeric(12, 4) NOT NULL,
  serving_id text,
  serving_label text,
  PRIMARY KEY (owner_id, id),
  FOREIGN KEY (owner_id, entry_id) REFERENCES nutrition_diary_entries(owner_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS nutrition_goals (
  owner_id uuid NOT NULL PRIMARY KEY,
  calories_target numeric(12, 4) NOT NULL,
  protein_target_g numeric(12, 4) NOT NULL,
  carbs_target_g numeric(12, 4) NOT NULL,
  fat_target_g numeric(12, 4) NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS nutrition_usage_stats (
  owner_id uuid NOT NULL,
  item_type text NOT NULL,
  item_id text NOT NULL,
  use_count integer NOT NULL,
  last_used_at timestamptz NOT NULL,
  morning_count integer NOT NULL,
  midday_count integer NOT NULL,
  evening_count integer NOT NULL,
  latenight_count integer NOT NULL,
  PRIMARY KEY (owner_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_calendars_owner_trash_created ON calendar_calendars(owner_id, trashed_at, created_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_categories_owner_calendar ON calendar_categories(owner_id, calendar_id, trashed_at, name ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_categories_owner_name ON calendar_categories(owner_id, trashed_at, name ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_range ON calendar_events(owner_id, starts_at ASC, ends_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_calendar ON calendar_events(owner_id, calendar_id, trashed_at, starts_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_category ON calendar_events(owner_id, category_id, trashed_at, starts_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_recurrence_target ON calendar_recurrence_rules(owner_id, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_event ON calendar_recurrence_exceptions(owner_id, event_id, occurrence_key);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_owner_due ON calendar_tasks(owner_id, trashed_at, due_at ASC, due_date ASC, updated_at ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_owner_category ON calendar_tasks(owner_id, category_id, trashed_at, id ASC);
CREATE INDEX IF NOT EXISTS idx_calendar_task_recurrence_task ON calendar_task_recurrence_rules(owner_id, task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_undo_owner_created ON calendar_undo_actions(owner_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_owner_category_name ON workout_exercises(owner_id, category ASC, name ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_workout_routines_owner_active_updated ON workout_routines(owner_id, updated_at DESC, id DESC) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workout_routines_owner_updated ON workout_routines(owner_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_owner_active ON workout_sessions(owner_id, updated_at DESC, id DESC) WHERE finished_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workout_sessions_owner_finished ON workout_sessions(owner_id, finished_at DESC, updated_at DESC, id DESC) WHERE finished_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workout_routine_exercises_owner_routine ON workout_routine_exercises(owner_id, routine_id, order_index ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_workout_routine_exercises_owner_exercise ON workout_routine_exercises(owner_id, exercise_id, routine_id);
CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_owner_session ON workout_session_exercises(owner_id, session_id, order_index ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_owner_exercise ON workout_session_exercises(owner_id, exercise_id, session_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_owner_session_exercise ON workout_sets(owner_id, session_exercise_id, set_index ASC, id ASC);

CREATE INDEX IF NOT EXISTS idx_nutrition_foods_owner_source_name ON nutrition_foods(owner_id, source_type ASC, name ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_nutrition_foods_owner_name_search ON nutrition_foods(owner_id, lower(name), id ASC);
CREATE INDEX IF NOT EXISTS idx_nutrition_foods_owner_brand_search ON nutrition_foods(owner_id, lower(COALESCE(brand_name, '')), lower(name), id ASC);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipes_owner_updated ON nutrition_recipes(owner_id, updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_ingredients_owner_recipe ON nutrition_recipe_ingredients(owner_id, recipe_id, order_index ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_nutrition_recipe_ingredients_owner_food ON nutrition_recipe_ingredients(owner_id, food_id, recipe_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_diary_entries_owner_logged ON nutrition_diary_entries(owner_id, logged_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_nutrition_diary_items_owner_entry ON nutrition_diary_items(owner_id, entry_id, id ASC);
CREATE INDEX IF NOT EXISTS idx_nutrition_diary_items_owner_item ON nutrition_diary_items(owner_id, item_type, item_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_usage_stats_owner_last_used ON nutrition_usage_stats(owner_id, last_used_at DESC, item_type, item_id);

ALTER TABLE calendar_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_recurrence_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_task_recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_undo_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_diary_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_diary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_usage_stats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  calendar_calendars,
  calendar_categories,
  calendar_events,
  calendar_recurrence_rules,
  calendar_recurrence_exceptions,
  calendar_tasks,
  calendar_task_recurrence_rules,
  calendar_settings,
  calendar_undo_actions,
  workout_exercises,
  workout_routines,
  workout_routine_exercises,
  workout_sessions,
  workout_session_exercises,
  workout_sets,
  nutrition_foods,
  nutrition_recipes,
  nutrition_recipe_ingredients,
  nutrition_diary_entries,
  nutrition_diary_items,
  nutrition_goals,
  nutrition_usage_stats
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  calendar_calendars,
  calendar_categories,
  calendar_events,
  calendar_recurrence_rules,
  calendar_recurrence_exceptions,
  calendar_tasks,
  calendar_task_recurrence_rules,
  calendar_settings,
  calendar_undo_actions,
  workout_exercises,
  workout_routines,
  workout_routine_exercises,
  workout_sessions,
  workout_session_exercises,
  workout_sets,
  nutrition_foods,
  nutrition_recipes,
  nutrition_recipe_ingredients,
  nutrition_diary_entries,
  nutrition_diary_items,
  nutrition_goals,
  nutrition_usage_stats
TO authenticated;

DROP POLICY IF EXISTS calendar_calendars_authenticated_owner ON calendar_calendars;
CREATE POLICY calendar_calendars_authenticated_owner ON calendar_calendars FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_categories_authenticated_owner ON calendar_categories;
CREATE POLICY calendar_categories_authenticated_owner ON calendar_categories FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_events_authenticated_owner ON calendar_events;
CREATE POLICY calendar_events_authenticated_owner ON calendar_events FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_recurrence_rules_authenticated_owner ON calendar_recurrence_rules;
CREATE POLICY calendar_recurrence_rules_authenticated_owner ON calendar_recurrence_rules FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_recurrence_exceptions_authenticated_owner ON calendar_recurrence_exceptions;
CREATE POLICY calendar_recurrence_exceptions_authenticated_owner ON calendar_recurrence_exceptions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_tasks_authenticated_owner ON calendar_tasks;
CREATE POLICY calendar_tasks_authenticated_owner ON calendar_tasks FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_task_recurrence_rules_authenticated_owner ON calendar_task_recurrence_rules;
CREATE POLICY calendar_task_recurrence_rules_authenticated_owner ON calendar_task_recurrence_rules FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_settings_authenticated_owner ON calendar_settings;
CREATE POLICY calendar_settings_authenticated_owner ON calendar_settings FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS calendar_undo_actions_authenticated_owner ON calendar_undo_actions;
CREATE POLICY calendar_undo_actions_authenticated_owner ON calendar_undo_actions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workout_exercises_authenticated_owner ON workout_exercises;
CREATE POLICY workout_exercises_authenticated_owner ON workout_exercises FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workout_routines_authenticated_owner ON workout_routines;
CREATE POLICY workout_routines_authenticated_owner ON workout_routines FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workout_routine_exercises_authenticated_owner ON workout_routine_exercises;
CREATE POLICY workout_routine_exercises_authenticated_owner ON workout_routine_exercises FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workout_sessions_authenticated_owner ON workout_sessions;
CREATE POLICY workout_sessions_authenticated_owner ON workout_sessions FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workout_session_exercises_authenticated_owner ON workout_session_exercises;
CREATE POLICY workout_session_exercises_authenticated_owner ON workout_session_exercises FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS workout_sets_authenticated_owner ON workout_sets;
CREATE POLICY workout_sets_authenticated_owner ON workout_sets FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_foods_authenticated_owner ON nutrition_foods;
CREATE POLICY nutrition_foods_authenticated_owner ON nutrition_foods FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_recipes_authenticated_owner ON nutrition_recipes;
CREATE POLICY nutrition_recipes_authenticated_owner ON nutrition_recipes FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_recipe_ingredients_authenticated_owner ON nutrition_recipe_ingredients;
CREATE POLICY nutrition_recipe_ingredients_authenticated_owner ON nutrition_recipe_ingredients FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_diary_entries_authenticated_owner ON nutrition_diary_entries;
CREATE POLICY nutrition_diary_entries_authenticated_owner ON nutrition_diary_entries FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_diary_items_authenticated_owner ON nutrition_diary_items;
CREATE POLICY nutrition_diary_items_authenticated_owner ON nutrition_diary_items FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_goals_authenticated_owner ON nutrition_goals;
CREATE POLICY nutrition_goals_authenticated_owner ON nutrition_goals FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS nutrition_usage_stats_authenticated_owner ON nutrition_usage_stats;
CREATE POLICY nutrition_usage_stats_authenticated_owner ON nutrition_usage_stats FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
