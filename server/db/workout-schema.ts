import type BetterSqlite3 from 'better-sqlite3';
import { recreateTable, tableHasColumn, normalizeOwnerIds } from './schema-utils';

const workoutRoutineExercisesTableSql = `
  CREATE TABLE IF NOT EXISTS workout_routine_exercises (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    routine_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    target_sets INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (routine_id) REFERENCES workout_routines(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
  );
`;

const workoutSessionExercisesTableSql = `
  CREATE TABLE IF NOT EXISTS workout_session_exercises (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    notes TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
  );
`;

const workoutSetsTableSql = `
  CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    session_exercise_id TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    rir REAL,
    reps REAL,
    weight REAL,
    completed INTEGER NOT NULL,
    FOREIGN KEY (session_exercise_id) REFERENCES workout_session_exercises(id) ON DELETE CASCADE
  );
`;

export function ensureWorkoutSchema(database: BetterSqlite3.Database) {
  if (!tableHasColumn(database, 'workout_routine_exercises', 'owner_id')) {
    recreateTable(database, 'workout_routine_exercises', workoutRoutineExercisesTableSql, (legacyTableName) => `
      INSERT INTO workout_routine_exercises (id, owner_id, routine_id, exercise_id, order_index, target_sets, created_at)
      SELECT legacy.id, routine.owner_id, legacy.routine_id, legacy.exercise_id, legacy.order_index, legacy.target_sets, legacy.created_at
      FROM "${legacyTableName}" legacy
      JOIN workout_routines routine ON routine.id = legacy.routine_id
    `);
  }

  if (!tableHasColumn(database, 'workout_session_exercises', 'owner_id')) {
    recreateTable(database, 'workout_session_exercises', workoutSessionExercisesTableSql, (legacyTableName) => `
      INSERT INTO workout_session_exercises (id, owner_id, session_id, exercise_id, order_index, notes)
      SELECT legacy.id, session.owner_id, legacy.session_id, legacy.exercise_id, legacy.order_index, legacy.notes
      FROM "${legacyTableName}" legacy
      JOIN workout_sessions session ON session.id = legacy.session_id
    `);
  }

  if (!tableHasColumn(database, 'workout_sets', 'owner_id')) {
    recreateTable(database, 'workout_sets', workoutSetsTableSql, (legacyTableName) => `
      INSERT INTO workout_sets (id, owner_id, session_exercise_id, set_index, rir, reps, weight, completed)
      SELECT legacy.id, session_exercise.owner_id, legacy.session_exercise_id, legacy.set_index, legacy.rir, legacy.reps, legacy.weight, legacy.completed
      FROM "${legacyTableName}" legacy
      JOIN workout_session_exercises session_exercise ON session_exercise.id = legacy.session_exercise_id
    `);
  }

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

    ${workoutRoutineExercisesTableSql}

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      routine_id TEXT,
      name TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      updated_at TEXT NOT NULL
    );

    ${workoutSessionExercisesTableSql}

    ${workoutSetsTableSql}

    CREATE INDEX IF NOT EXISTS idx_workout_exercises_owner_name ON workout_exercises(owner_id, name);
    CREATE INDEX IF NOT EXISTS idx_workout_routines_owner_updated ON workout_routines(owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_owner_active ON workout_sessions(owner_id, finished_at, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workout_routine_exercises_owner_routine ON workout_routine_exercises(owner_id, routine_id, order_index, id);
    CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_owner_session ON workout_session_exercises(owner_id, session_id, order_index, id);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_owner_exercise ON workout_sets(owner_id, session_exercise_id, set_index, id);
  `);

  normalizeOwnerIds(database, 'workout_exercises');
  normalizeOwnerIds(database, 'workout_routines');
  normalizeOwnerIds(database, 'workout_routine_exercises');
  normalizeOwnerIds(database, 'workout_sessions');
  normalizeOwnerIds(database, 'workout_session_exercises');
  normalizeOwnerIds(database, 'workout_sets');
}
