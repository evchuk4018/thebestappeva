import crypto from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import type { WorkoutExerciseInput, WorkoutRoutineInput, WorkoutSession } from '../../shared/workout-contract';
import { defaultRoutines, presetExercises } from './workout-seed';
import { getDatabase } from './database';
import { localWorkoutOwnerId, mapExercise, mapRoutine, mapRoutineExercise, mapSession, mapSessionExercise, mapSet, type WorkoutRow } from './workout-mappers';

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function slug(text: string) {
  return `ex_${text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

function setSummary(row: WorkoutRow) {
  const weight = row.weight === null ? '-' : Number(row.weight).toLocaleString();
  const reps = row.reps === null ? '-' : Number(row.reps).toLocaleString();
  const rir = row.rir === null ? '' : `, RIR ${Number(row.rir).toLocaleString()}`;
  return `${weight} x ${reps}${rir}`;
}

export function createWorkoutRepository(database: BetterSqlite3.Database = getDatabase()) {
  const owner = localWorkoutOwnerId;

  function exerciseByName(name: string) {
    return database.prepare('SELECT * FROM workout_exercises WHERE owner_id = ? AND name = ?').get(owner, name) as WorkoutRow | undefined;
  }

  function routineExercises(routineId: string) {
    return (database.prepare(`
      SELECT re.*, e.name AS exercise_name FROM workout_routine_exercises re
      JOIN workout_exercises e ON e.id = re.exercise_id
      WHERE re.routine_id = ? ORDER BY re.order_index, re.id
    `).all(routineId) as WorkoutRow[]).map(mapRoutineExercise);
  }

  function lastPerformed(exerciseId: string, currentSessionId: string) {
    const row = database.prepare(`
      SELECT se.id FROM workout_session_exercises se
      JOIN workout_sessions s ON s.id = se.session_id
      WHERE s.owner_id = ? AND s.finished_at IS NOT NULL AND s.id != ? AND se.exercise_id = ?
      ORDER BY s.finished_at DESC, s.id DESC LIMIT 1
    `).get(owner, currentSessionId, exerciseId) as WorkoutRow | undefined;
    if (!row) return null;
    const sets = database.prepare('SELECT * FROM workout_sets WHERE session_exercise_id = ? AND completed = 1 ORDER BY set_index LIMIT 4').all(row.id) as WorkoutRow[];
    return sets.length ? `Last: ${sets.map(setSummary).join(' | ')}` : null;
  }

  function sessionExercises(sessionId: string) {
    const rows = database.prepare(`
      SELECT se.*, e.name AS exercise_name FROM workout_session_exercises se
      JOIN workout_exercises e ON e.id = se.exercise_id
      WHERE se.session_id = ? ORDER BY se.order_index, se.id
    `).all(sessionId) as WorkoutRow[];
    return rows.map((row) => {
      const sets = (database.prepare('SELECT * FROM workout_sets WHERE session_exercise_id = ? ORDER BY set_index, id').all(row.id) as WorkoutRow[]).map(mapSet);
      return mapSessionExercise(row, sets, lastPerformed(String(row.exercise_id), sessionId));
    });
  }

  function sessionById(sessionId: string) {
    const row = database.prepare('SELECT * FROM workout_sessions WHERE owner_id = ? AND id = ?').get(owner, sessionId) as WorkoutRow | undefined;
    return row ? mapSession(row, sessionExercises(sessionId)) : null;
  }

  function saveRoutineExercises(routineId: string, exercises: WorkoutRoutineInput['exercises']) {
    database.prepare('DELETE FROM workout_routine_exercises WHERE routine_id = ?').run(routineId);
    const insert = database.prepare('INSERT INTO workout_routine_exercises (id, routine_id, exercise_id, order_index, target_sets, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    exercises.forEach((exercise, index) => insert.run(id('rex'), routineId, exercise.exerciseId, exercise.orderIndex ?? index, exercise.targetSets ?? 3, now()));
  }

  function insertSessionExercise(sessionId: string, exerciseId: string, orderIndex: number, targetSets = 3) {
    const sessionExerciseId = id('sex');
    database.prepare('INSERT INTO workout_session_exercises (id, session_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?)')
      .run(sessionExerciseId, sessionId, exerciseId, orderIndex, '');
    const insertSet = database.prepare('INSERT INTO workout_sets (id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES (?, ?, ?, NULL, NULL, NULL, 0)');
    for (let index = 0; index < targetSets; index += 1) insertSet.run(id('set'), sessionExerciseId, index);
  }

  return {
    ensureDefaults() {
      const createdAt = now();
      const insertExercise = database.prepare(`
        INSERT OR IGNORE INTO workout_exercises (id, owner_id, name, category, equipment, is_preset, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      `);
      presetExercises.forEach((exercise) => insertExercise.run(slug(exercise.name), owner, exercise.name, exercise.category, exercise.equipment, createdAt, createdAt));
      if (database.prepare('SELECT id FROM workout_routines WHERE owner_id = ? LIMIT 1').get(owner)) return;
      defaultRoutines.forEach((routine) => {
        const routineId = id('routine');
        database.prepare('INSERT INTO workout_routines (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(routineId, owner, routine.name, createdAt, createdAt);
        saveRoutineExercises(routineId, routine.exercises.flatMap((name, index) => {
          const exercise = exerciseByName(name);
          return exercise ? [{ exerciseId: String(exercise.id), orderIndex: index, targetSets: 3 }] : [];
        }));
      });
    },
    bootstrap() {
      this.ensureDefaults();
      return { exercises: this.listExercises(), routines: this.listRoutines(), activeSession: this.activeSession() };
    },
    listExercises() {
      return (database.prepare('SELECT * FROM workout_exercises WHERE owner_id = ? ORDER BY category, name').all(owner) as WorkoutRow[]).map(mapExercise);
    },
    listRoutines() {
      const rows = database.prepare('SELECT * FROM workout_routines WHERE owner_id = ? AND archived_at IS NULL ORDER BY updated_at DESC, id DESC').all(owner) as WorkoutRow[];
      return rows.map((row) => mapRoutine(row, routineExercises(String(row.id))));
    },
    createExercise(input: WorkoutExerciseInput) {
      const exerciseId = id('ex');
      const createdAt = now();
      database.prepare('INSERT INTO workout_exercises (id, owner_id, name, category, equipment, is_preset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
        .run(exerciseId, owner, input.name.trim(), input.category ?? 'Custom', input.equipment ?? 'Other', createdAt, createdAt);
      return mapExercise(database.prepare('SELECT * FROM workout_exercises WHERE id = ?').get(exerciseId) as WorkoutRow);
    },
    saveRoutine(routineId: string | null, input: WorkoutRoutineInput) {
      const routine = routineId ? database.prepare('SELECT * FROM workout_routines WHERE owner_id = ? AND id = ?').get(owner, routineId) as WorkoutRow | undefined : null;
      const nextId = routineId ?? id('routine');
      const createdAt = routine ? String(routine.created_at) : now();
      database.transaction(() => {
        database.prepare('INSERT INTO workout_routines (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, archived_at = NULL')
          .run(nextId, owner, input.name.trim(), createdAt, now());
        saveRoutineExercises(nextId, input.exercises);
      })();
      return this.listRoutines().find((item) => item.id === nextId)!;
    },
    archiveRoutine(routineId: string) {
      const result = database.prepare('UPDATE workout_routines SET archived_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?').run(now(), now(), owner, routineId);
      return result.changes > 0;
    },
    activeSession() {
      const row = database.prepare('SELECT * FROM workout_sessions WHERE owner_id = ? AND finished_at IS NULL ORDER BY updated_at DESC LIMIT 1').get(owner) as WorkoutRow | undefined;
      return row ? sessionById(String(row.id)) : null;
    },
    startEmptySession() {
      const active = this.activeSession();
      if (active) return active;
      const sessionId = id('session');
      const createdAt = now();
      database.prepare('INSERT INTO workout_sessions (id, owner_id, routine_id, name, started_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)')
        .run(sessionId, owner, 'Empty Workout', createdAt, createdAt);
      return sessionById(sessionId)!;
    },
    startRoutineSession(routineId: string) {
      const active = this.activeSession();
      if (active) return active;
      const routine = this.listRoutines().find((item) => item.id === routineId);
      if (!routine) return null;
      const sessionId = id('session');
      const createdAt = now();
      database.transaction(() => {
        database.prepare('INSERT INTO workout_sessions (id, owner_id, routine_id, name, started_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(sessionId, owner, routine.id, routine.name, createdAt, createdAt);
        routine.exercises.forEach((exercise) => insertSessionExercise(sessionId, exercise.exerciseId, exercise.orderIndex, exercise.targetSets));
      })();
      return sessionById(sessionId);
    },
    saveSession(session: WorkoutSession) {
      if (!database.prepare('SELECT id FROM workout_sessions WHERE owner_id = ? AND id = ?').get(owner, session.id)) return null;
      database.transaction(() => {
        database.prepare('UPDATE workout_sessions SET name = ?, routine_id = ?, started_at = ?, finished_at = ?, updated_at = ? WHERE owner_id = ? AND id = ?')
          .run(session.name.trim(), session.routineId, session.startedAt, session.finishedAt, now(), owner, session.id);
        database.prepare('DELETE FROM workout_session_exercises WHERE session_id = ?').run(session.id);
        const insertExercise = database.prepare('INSERT INTO workout_session_exercises (id, session_id, exercise_id, order_index, notes) VALUES (?, ?, ?, ?, ?)');
        const insertSet = database.prepare('INSERT INTO workout_sets (id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES (?, ?, ?, ?, ?, ?, ?)');
        session.exercises.forEach((exercise, index) => {
          insertExercise.run(exercise.id, session.id, exercise.exerciseId, exercise.orderIndex ?? index, exercise.notes ?? '');
          exercise.sets.forEach((set, setIndex) => insertSet.run(set.id, exercise.id, set.setIndex ?? setIndex, set.rir, set.reps, set.weight, set.completed ? 1 : 0));
        });
      })();
      return sessionById(session.id);
    },
    finishSession(session: WorkoutSession) {
      const saved = this.saveSession({ ...session, finishedAt: session.finishedAt ?? now() });
      return saved ? sessionById(saved.id) : null;
    },
    deleteSession(sessionId: string) {
      return database.prepare('DELETE FROM workout_sessions WHERE owner_id = ? AND id = ?').run(owner, sessionId).changes > 0;
    },
  };
}

export const workoutRepository = createWorkoutRepository();
