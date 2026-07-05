import crypto from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { WorkoutExerciseInput, WorkoutLoggedSessionInput, WorkoutRoutineInput, WorkoutSession } from '../../shared/workout-contract';
import { defaultRoutines, presetExercises } from './workout-seed';
import { getPostgresPool } from './postgres';
import { assertOwnerUuid, runPostgresTransaction, toIsoString, type PostgresExecutor } from './postgres-repository-utils';
import { mapExercise, mapHistoryEntry, mapRoutine, mapRoutineExercise, mapSession, mapSessionExercise, mapSet, type WorkoutRow } from './workout-mappers';
import { getWorkoutSessionExpiry, isWorkoutSessionExpired } from './workout-session-expiry';

type Row = Record<string, unknown>;

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function slug(text: string) {
  return `ex_${text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
}

function normalizeRow(row: Row): WorkoutRow {
  const next: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(row)) {
    next[key] = value instanceof Date ? toIsoString(value) : value === null ? null : value as string | number;
  }
  return next;
}

function setSummary(row: WorkoutRow) {
  const weight = row.weight === null ? '-' : Number(row.weight).toLocaleString();
  const reps = row.reps === null ? '-' : Number(row.reps).toLocaleString();
  const rir = row.rir === null ? '' : `, RIR ${Number(row.rir).toLocaleString()}`;
  return `${weight} x ${reps}${rir}`;
}

export function createPostgresWorkoutRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
  getNow = now,
) {
  const owner = assertOwnerUuid(ownerId);

  async function exerciseByName(name: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM workout_exercises WHERE owner_id = $1 AND name = $2', [owner, name]);
    return result.rows[0] ? normalizeRow(result.rows[0] as Row) : null;
  }

  async function exerciseExists(exerciseId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT id FROM workout_exercises WHERE owner_id = $1 AND id = $2', [owner, exerciseId]);
    return Boolean(result.rows[0]);
  }

  async function routineExists(routineId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT id FROM workout_routines WHERE owner_id = $1 AND id = $2 AND archived_at IS NULL', [owner, routineId]);
    return Boolean(result.rows[0]);
  }

  async function routineExercises(routineId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query(`
      SELECT re.*, e.name AS exercise_name FROM workout_routine_exercises re
      JOIN workout_exercises e ON e.owner_id = re.owner_id AND e.id = re.exercise_id
      WHERE re.owner_id = $1 AND re.routine_id = $2 ORDER BY re.order_index, re.id
    `, [owner, routineId]);
    return result.rows.map((row) => mapRoutineExercise(normalizeRow(row as Row)));
  }

  async function lastPerformed(exerciseId: string, currentSessionId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query(`
      SELECT se.id FROM workout_session_exercises se
      JOIN workout_sessions s ON s.owner_id = se.owner_id AND s.id = se.session_id
      WHERE s.owner_id = $1 AND s.finished_at IS NOT NULL AND s.id != $2 AND se.exercise_id = $3
      ORDER BY s.finished_at DESC, s.id DESC LIMIT 1
    `, [owner, currentSessionId, exerciseId]);
    const row = result.rows[0] as Row | undefined;
    if (!row) return null;
    const sets = await nextExecutor.query('SELECT * FROM workout_sets WHERE owner_id = $1 AND session_exercise_id = $2 AND completed = true ORDER BY set_index LIMIT 4', [owner, String(row.id)]);
    const normalized = sets.rows.map((set) => normalizeRow(set as Row));
    return normalized.length ? `Last: ${normalized.map(setSummary).join(' | ')}` : null;
  }

  async function sessionExercises(sessionId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query(`
      SELECT se.*, e.name AS exercise_name FROM workout_session_exercises se
      JOIN workout_exercises e ON e.owner_id = se.owner_id AND e.id = se.exercise_id
      WHERE se.owner_id = $1 AND se.session_id = $2 ORDER BY se.order_index, se.id
    `, [owner, sessionId]);
    const exercises = [] as ReturnType<typeof mapSessionExercise>[];
    for (const row of result.rows) {
      const normalized = normalizeRow(row as Row);
      const sets = await nextExecutor.query('SELECT * FROM workout_sets WHERE owner_id = $1 AND session_exercise_id = $2 ORDER BY set_index, id', [owner, normalized.id]);
      exercises.push(mapSessionExercise(normalized, sets.rows.map((set) => mapSet(normalizeRow(set as Row))), await lastPerformed(String(normalized.exercise_id), sessionId, nextExecutor)));
    }
    return exercises;
  }

  async function sessionById(sessionId: string, nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT * FROM workout_sessions WHERE owner_id = $1 AND id = $2', [owner, sessionId]);
    return result.rows[0] ? mapSession(normalizeRow(result.rows[0] as Row), await sessionExercises(sessionId, nextExecutor)) : null;
  }

  async function saveRoutineExercises(routineId: string, exercises: WorkoutRoutineInput['exercises'], nextExecutor: PostgresExecutor) {
    await nextExecutor.query('DELETE FROM workout_routine_exercises WHERE owner_id = $1 AND routine_id = $2', [owner, routineId]);
    for (const [index, exercise] of exercises.entries()) {
      await nextExecutor.query('INSERT INTO workout_routine_exercises (owner_id, id, routine_id, exercise_id, order_index, target_sets, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [owner, id('rex'), routineId, exercise.exerciseId, exercise.orderIndex ?? index, exercise.targetSets ?? 3, getNow()]);
    }
  }

  async function finishExpiredSessions(referenceTime = getNow(), nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    const result = await nextExecutor.query('SELECT id, started_at FROM workout_sessions WHERE owner_id = $1 AND finished_at IS NULL', [owner]);
    const expired = result.rows.flatMap((row) => {
      const startedAt = toIsoString((row as Row).started_at);
      return isWorkoutSessionExpired(startedAt, null, referenceTime) ? [{ id: String((row as Row).id), finishedAt: getWorkoutSessionExpiry(startedAt) }] : [];
    });
    for (const row of expired) {
      await nextExecutor.query('UPDATE workout_sessions SET finished_at = $1, updated_at = $2 WHERE owner_id = $3 AND id = $4 AND finished_at IS NULL', [row.finishedAt, referenceTime, owner, row.id]);
    }
  }

  async function insertSessionExercise(sessionId: string, exerciseId: string, orderIndex: number, targetSets: number, nextExecutor: PostgresExecutor) {
    const sessionExerciseId = id('sex');
    await nextExecutor.query('INSERT INTO workout_session_exercises (owner_id, id, session_id, exercise_id, order_index, notes) VALUES ($1, $2, $3, $4, $5, $6)', [owner, sessionExerciseId, sessionId, exerciseId, orderIndex, '']);
    for (let index = 0; index < targetSets; index += 1) {
      await nextExecutor.query('INSERT INTO workout_sets (owner_id, id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES ($1, $2, $3, $4, NULL, NULL, NULL, false)', [owner, id('set'), sessionExerciseId, index]);
    }
  }

  async function replaceSessionExercises(session: WorkoutSession, nextExecutor: PostgresExecutor) {
    await nextExecutor.query('DELETE FROM workout_session_exercises WHERE owner_id = $1 AND session_id = $2', [owner, session.id]);
    for (const [index, exercise] of session.exercises.entries()) {
      await nextExecutor.query('INSERT INTO workout_session_exercises (owner_id, id, session_id, exercise_id, order_index, notes) VALUES ($1, $2, $3, $4, $5, $6)', [owner, exercise.id, session.id, exercise.exerciseId, exercise.orderIndex ?? index, exercise.notes ?? '']);
      for (const [setIndex, set] of exercise.sets.entries()) {
        await nextExecutor.query('INSERT INTO workout_sets (owner_id, id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [owner, set.id, exercise.id, set.setIndex ?? setIndex, set.rir, set.reps, set.weight, set.completed]);
      }
    }
  }

  async function saveSessionRecord(session: WorkoutSession, finishAt: string | null, nextExecutor: PostgresExecutor) {
    await nextExecutor.query('UPDATE workout_sessions SET name = $3, routine_id = $4, started_at = $5, finished_at = $6, updated_at = $7 WHERE owner_id = $1 AND id = $2', [owner, session.id, session.name.trim(), session.routineId, session.startedAt, finishAt, getNow()]);
    await replaceSessionExercises(session, nextExecutor);
  }

  async function assertLoggedSessionReferences(input: WorkoutLoggedSessionInput) {
    if (input.routineId && !await routineExists(input.routineId)) throw new Error('Routine was not found.');
    for (const exercise of input.exercises) {
      if (!await exerciseExists(exercise.exerciseId)) throw new Error(`Exercise "${exercise.exerciseId}" was not found.`);
    }
  }

  return {
    async ensureDefaults() {
      const createdAt = getNow();
      await runPostgresTransaction(executor, async (client) => {
        for (const exercise of presetExercises) {
          await client.query(`
            INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, true, $6, $7)
            ON CONFLICT (owner_id, id) DO NOTHING
          `, [owner, slug(exercise.name), exercise.name, exercise.category, exercise.equipment, createdAt, createdAt]);
        }
        const routineCount = await client.query('SELECT id FROM workout_routines WHERE owner_id = $1 LIMIT 1', [owner]);
        if (routineCount.rows[0]) return;
        for (const routine of defaultRoutines) {
          const routineId = id('routine');
          await client.query('INSERT INTO workout_routines (owner_id, id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [owner, routineId, routine.name, createdAt, createdAt]);
          const exercises = [] as WorkoutRoutineInput['exercises'];
          for (const [index, name] of routine.exercises.entries()) {
            const exercise = await exerciseByName(name, client);
            if (exercise) exercises.push({ exerciseId: String(exercise.id), orderIndex: index, targetSets: 3 });
          }
          await saveRoutineExercises(routineId, exercises, client);
        }
      });
    },
    async bootstrap() {
      await this.ensureDefaults();
      return { exercises: await this.listExercises(), routines: await this.listRoutines(), activeSession: await this.activeSession() };
    },
    async listExercises() {
      const result = await (executor as PostgresExecutor).query('SELECT * FROM workout_exercises WHERE owner_id = $1 ORDER BY category, name', [owner]);
      return result.rows.map((row) => mapExercise(normalizeRow(row as Row)));
    },
    async listRoutines() {
      const result = await (executor as PostgresExecutor).query('SELECT * FROM workout_routines WHERE owner_id = $1 AND archived_at IS NULL ORDER BY updated_at DESC, id DESC', [owner]);
      const routines = [] as ReturnType<typeof mapRoutine>[];
      for (const row of result.rows) routines.push(mapRoutine(normalizeRow(row as Row), await routineExercises(String((row as Row).id))));
      return routines;
    },
    async listFinishedSessions(options: { limit?: number; query?: string; exerciseId?: string } = {}) {
      await finishExpiredSessions();
      const search = options.query?.trim().toLowerCase() || null;
      const like = search ? `%${search}%` : null;
      const exerciseId = options.exerciseId?.trim() || null;
      const limit = Math.max(1, Math.min(options.limit ?? 20, 100));
      const result = await (executor as PostgresExecutor).query(`
        SELECT s.*,
          COALESCE((SELECT STRING_AGG(named.name, '|' ORDER BY named.order_index, named.id) FROM (
            SELECT e.name, se.order_index, se.id FROM workout_session_exercises se
            JOIN workout_exercises e ON e.owner_id = se.owner_id AND e.id = se.exercise_id
            WHERE se.owner_id = s.owner_id AND se.session_id = s.id
          ) named), '') AS exercise_names,
          COALESCE((SELECT COUNT(*) FROM workout_session_exercises se WHERE se.owner_id = s.owner_id AND se.session_id = s.id), 0) AS exercise_count,
          COALESCE((SELECT COUNT(*) FROM workout_sets ws JOIN workout_session_exercises se ON se.owner_id = ws.owner_id AND se.id = ws.session_exercise_id WHERE se.owner_id = s.owner_id AND se.session_id = s.id AND ws.completed = true), 0) AS completed_set_count
        FROM workout_sessions s
        WHERE s.owner_id = $1 AND s.finished_at IS NOT NULL
          AND ($2::text IS NULL OR LOWER(s.name) LIKE $3 OR EXISTS(
            SELECT 1 FROM workout_session_exercises se
            JOIN workout_exercises e ON e.owner_id = se.owner_id AND e.id = se.exercise_id
            WHERE se.owner_id = s.owner_id AND se.session_id = s.id AND LOWER(e.name) LIKE $3
          ))
          AND ($4::text IS NULL OR EXISTS(
            SELECT 1 FROM workout_session_exercises se WHERE se.owner_id = s.owner_id AND se.session_id = s.id AND se.exercise_id = $4
          ))
        ORDER BY s.finished_at DESC, s.updated_at DESC, s.id DESC
        LIMIT $5
      `, [owner, like, like, exerciseId, limit]);
      return result.rows.map((row) => mapHistoryEntry(normalizeRow(row as Row)));
    },
    async createExercise(input: WorkoutExerciseInput) {
      const exerciseId = id('ex');
      const createdAt = getNow();
      await (executor as PostgresExecutor).query('INSERT INTO workout_exercises (owner_id, id, name, category, equipment, is_preset, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, false, $6, $7)', [owner, exerciseId, input.name.trim(), input.category ?? 'Custom', input.equipment ?? 'Other', createdAt, createdAt]);
      const result = await (executor as PostgresExecutor).query('SELECT * FROM workout_exercises WHERE owner_id = $1 AND id = $2', [owner, exerciseId]);
      return mapExercise(normalizeRow(result.rows[0] as Row));
    },
    async saveRoutine(routineId: string | null, input: WorkoutRoutineInput) {
      const nextId = routineId ?? id('routine');
      await runPostgresTransaction(executor, async (client) => {
        const existing = routineId ? await client.query('SELECT created_at FROM workout_routines WHERE owner_id = $1 AND id = $2', [owner, routineId]) : null;
        const createdAt = existing?.rows[0] ? toIsoString((existing.rows[0] as Row).created_at) : getNow();
        await client.query(`
          INSERT INTO workout_routines (owner_id, id, name, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (owner_id, id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, archived_at = NULL
        `, [owner, nextId, input.name.trim(), createdAt, getNow()]);
        await saveRoutineExercises(nextId, input.exercises, client);
      });
      return (await this.listRoutines()).find((item) => item.id === nextId)!;
    },
    async archiveRoutine(routineId: string) {
      const result = await (executor as PostgresExecutor).query('UPDATE workout_routines SET archived_at = $3, updated_at = $4 WHERE owner_id = $1 AND id = $2', [owner, routineId, getNow(), getNow()]);
      return (result.rowCount ?? 0) > 0;
    },
    async activeSession() {
      await finishExpiredSessions();
      const result = await (executor as PostgresExecutor).query('SELECT * FROM workout_sessions WHERE owner_id = $1 AND finished_at IS NULL ORDER BY updated_at DESC LIMIT 1', [owner]);
      return result.rows[0] ? sessionById(String((result.rows[0] as Row).id)) : null;
    },
    async getSession(sessionId: string) {
      await finishExpiredSessions();
      return sessionById(sessionId);
    },
    async startEmptySession() {
      const active = await this.activeSession();
      if (active) return active;
      const sessionId = id('session');
      const createdAt = getNow();
      await (executor as PostgresExecutor).query('INSERT INTO workout_sessions (owner_id, id, routine_id, name, started_at, updated_at) VALUES ($1, $2, NULL, $3, $4, $5)', [owner, sessionId, 'Empty Workout', createdAt, createdAt]);
      return (await sessionById(sessionId))!;
    },
    async startRoutineSession(routineId: string) {
      const active = await this.activeSession();
      if (active) return active;
      const routine = (await this.listRoutines()).find((item) => item.id === routineId);
      if (!routine) return null;
      const sessionId = id('session');
      const createdAt = getNow();
      await runPostgresTransaction(executor, async (client) => {
        await client.query('INSERT INTO workout_sessions (owner_id, id, routine_id, name, started_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)', [owner, sessionId, routine.id, routine.name, createdAt, createdAt]);
        for (const exercise of routine.exercises) await insertSessionExercise(sessionId, exercise.exerciseId, exercise.orderIndex, exercise.targetSets, client);
      });
      return sessionById(sessionId);
    },
    async saveSession(session: WorkoutSession) {
      const existing = await (executor as PostgresExecutor).query('SELECT id, started_at FROM workout_sessions WHERE owner_id = $1 AND id = $2', [owner, session.id]);
      if (!existing.rows[0]) return null;
      await finishExpiredSessions();
      const startedAt = toIsoString((existing.rows[0] as Row).started_at);
      const finishAt = isWorkoutSessionExpired(startedAt, null, getNow()) ? getWorkoutSessionExpiry(startedAt) : session.finishedAt;
      await runPostgresTransaction(executor, async (client) => { await saveSessionRecord(session, finishAt, client); });
      return sessionById(session.id);
    },
    async finishSession(session: WorkoutSession) {
      const saved = await this.saveSession({ ...session, finishedAt: session.finishedAt ?? getNow() });
      return saved ? sessionById(saved.id) : null;
    },
    async logCompletedSession(input: WorkoutLoggedSessionInput) {
      await assertLoggedSessionReferences(input);
      const sessionId = id('session');
      await runPostgresTransaction(executor, async (client) => {
        await client.query('INSERT INTO workout_sessions (owner_id, id, routine_id, name, started_at, finished_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [owner, sessionId, input.routineId ?? null, input.name.trim(), input.startedAt, input.finishedAt, getNow()]);
        for (const [index, exercise] of input.exercises.entries()) {
          const sessionExerciseId = id('sex');
          await client.query('INSERT INTO workout_session_exercises (owner_id, id, session_id, exercise_id, order_index, notes) VALUES ($1, $2, $3, $4, $5, $6)', [owner, sessionExerciseId, sessionId, exercise.exerciseId, exercise.orderIndex ?? index, exercise.notes ?? '']);
          for (const [setIndex, set] of exercise.sets.entries()) {
            await client.query('INSERT INTO workout_sets (owner_id, id, session_exercise_id, set_index, rir, reps, weight, completed) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [owner, id('set'), sessionExerciseId, set.setIndex ?? setIndex, set.rir ?? null, set.reps ?? null, set.weight ?? null, Boolean(set.completed)]);
          }
        }
      });
      return (await sessionById(sessionId))!;
    },
    async deleteSession(sessionId: string) {
      const result = await (executor as PostgresExecutor).query('DELETE FROM workout_sessions WHERE owner_id = $1 AND id = $2', [owner, sessionId]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
