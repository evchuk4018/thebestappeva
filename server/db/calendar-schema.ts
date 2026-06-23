import type BetterSqlite3 from 'better-sqlite3';

export function ensureCalendarSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS calendar_calendars (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      visible INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trashed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_categories (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trashed_at TEXT,
      FOREIGN KEY (calendar_id) REFERENCES calendar_calendars(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      category_id TEXT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL,
      location TEXT NOT NULL,
      timezone TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      all_day INTEGER NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trashed_at TEXT,
      FOREIGN KEY (calendar_id) REFERENCES calendar_calendars(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES calendar_categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_recurrence_rules (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      frequency TEXT NOT NULL,
      interval_count INTEGER NOT NULL,
      count_limit INTEGER,
      until_at TEXT,
      by_weekday_json TEXT NOT NULL,
      rrule_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_recurrence_exceptions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      occurrence_key TEXT NOT NULL,
      action TEXT NOT NULL,
      override_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_id, event_id, occurrence_key),
      FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_tasks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      category_id TEXT,
      title TEXT NOT NULL,
      notes TEXT NOT NULL,
      due_at TEXT,
      due_date TEXT,
      timezone TEXT NOT NULL,
      priority TEXT NOT NULL,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trashed_at TEXT,
      FOREIGN KEY (category_id) REFERENCES calendar_categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_task_recurrence_rules (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      frequency TEXT NOT NULL,
      interval_count INTEGER NOT NULL,
      count_limit INTEGER,
      until_at TEXT,
      by_weekday_json TEXT NOT NULL,
      rrule_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES calendar_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS calendar_settings (
      owner_id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL,
      week_start TEXT NOT NULL,
      hour_cycle TEXT NOT NULL,
      working_hours_start TEXT NOT NULL,
      working_hours_end TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_undo_actions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      action_kind TEXT NOT NULL,
      entity_kind TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_calendars_owner_trash ON calendar_calendars(owner_id, trashed_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_categories_owner_calendar ON calendar_categories(owner_id, calendar_id, trashed_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_range ON calendar_events(owner_id, starts_at, ends_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_calendar ON calendar_events(owner_id, calendar_id, trashed_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_category ON calendar_events(owner_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_recurrence_target ON calendar_recurrence_rules(owner_id, target_kind, target_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_event ON calendar_recurrence_exceptions(owner_id, event_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_tasks_owner_due ON calendar_tasks(owner_id, due_at, due_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_tasks_owner_category ON calendar_tasks(owner_id, category_id, trashed_at);
    CREATE INDEX IF NOT EXISTS idx_calendar_task_recurrence_task ON calendar_task_recurrence_rules(owner_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_calendar_undo_owner_created ON calendar_undo_actions(owner_id, created_at DESC, id DESC);
  `);
}
