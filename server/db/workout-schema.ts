import type BetterSqlite3 from 'better-sqlite3';

export function ensureWorkoutSchema(database: BetterSqlite3.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      equipment TEXT NOT NULL,
      is_preset INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner_id, name)
    );

    CREATE TABLE IF NOT EXISTS workout_routines (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workout_routine_exercises (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      target_sets INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      routine_id TEXT,
      name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workout_session_exercises (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      notes TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY,
      session_exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      rir REAL,
      reps REAL,
      weight REAL,
      completed INTEGER NOT NULL,
      FOREIGN KEY (session_exercise_id) REFERENCES workout_session_exercises(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_workout_exercises_owner_name ON workout_exercises(owner_id, name);
    CREATE INDEX IF NOT EXISTS idx_workout_routines_owner_updated ON workout_routines(owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_owner_active ON workout_sessions(owner_id, finished_at, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_session ON workout_session_exercises(session_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(session_exercise_id, set_index);
  `);
}
