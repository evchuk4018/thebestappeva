import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { Pool, type PoolClient } from 'pg';
import { createPostgresAutomationsRepository } from './postgres-automations-repository';
import { createPostgresCalendarRepository } from './postgres-calendar-repository';
import { assertSafePostgresTestDatabase } from './postgres-config';
import { createPostgresNutritionRepository } from './postgres-nutrition-repository';
import { createPostgresSkillsRepository } from './postgres-skills-repository';
import { createPostgresWorkoutRepository } from './postgres-workout-repository';

const migrationsUrl = new URL('../../supabase/migrations/', import.meta.url);
const migrationFileNames = (await readdir(migrationsUrl)).filter((name) => name.endsWith('.sql')).sort();
const migrationSqls = await Promise.all(migrationFileNames.map((name) => readFile(new URL(name, migrationsUrl), 'utf8')));
const connectionString = process.env.POSTGRES_TEST_DATABASE_URL
  ?? 'postgresql://thebestappeva:thebestappeva_test@127.0.0.1:54323/thebestappeva_test';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';

async function probePostgres() {
  try {
    assertSafePostgresTestDatabase(connectionString, 'POSTGRES_TEST_DATABASE_URL');
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 1000, max: 1 });
    await pool.query('SELECT 1');
    await pool.end();
    return null;
  } catch (error) {
    return `local test Postgres unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

const skipReason = await probePostgres();

function postgresTest(name: string, fn: () => Promise<void>) {
  return skipReason ? test(name, { skip: skipReason }, fn) : test(name, fn);
}

async function resetDatabase(client: PoolClient) {
  await client.query(`
    DROP TABLE IF EXISTS
      nutrition_usage_stats,
      nutrition_goals,
      nutrition_diary_items,
      nutrition_diary_entries,
      nutrition_recipe_ingredients,
      nutrition_recipes,
      nutrition_foods,
      workout_sets,
      workout_session_exercises,
      workout_sessions,
      workout_routine_exercises,
      workout_routines,
      workout_exercises,
      calendar_undo_actions,
      calendar_settings,
      calendar_task_recurrence_rules,
      calendar_tasks,
      calendar_recurrence_exceptions,
      calendar_recurrence_rules,
      calendar_events,
      calendar_categories,
      calendar_calendars,
      workspace_revision_state,
      automations,
      skills,
      docs_migration_sources,
      docs_citations,
      docs_versions,
      docs_tabs,
      docs_documents,
      ai_artifact_versions,
      ai_artifacts,
      ai_chats,
      app_settings
    CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
  `);
}

async function applyFreshMigration(pool: Pool) {
  const client = await pool.connect();
  try {
    await resetDatabase(client);
    for (const sql of migrationSqls) await client.query(sql);
  } finally {
    client.release();
  }
}

async function withPool<T>(run: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString, max: 6 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

function scheduleRequest(name: string, nextRunAt: string) {
  return {
    name,
    description: 'Run every morning.',
    kind: 'schedule' as const,
    trigger: { cadence: 'daily' as const, timezone: 'UTC', startDate: null, endDate: null, jitterMinutes: null, timeOfDay: '09:00' },
    action: { prompt: 'Summarize', linkedSkillId: null, linkedSkillName: null, requiredTools: [], disabledTools: [] },
    enabled: true,
    nextRunAt,
  };
}

postgresTest('scopes feature repositories by owner and preserves skill name uniqueness', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const skillsA = createPostgresSkillsRepository(ownerA, pool);
    const skillsB = createPostgresSkillsRepository(ownerB, pool);
    const autoA = createPostgresAutomationsRepository(ownerA, pool);
    const autoB = createPostgresAutomationsRepository(ownerB, pool);

    const mine = await skillsA.createSkill({ name: 'writer', description: 'mine', instructions: 'mine' });
    const other = await skillsB.createSkill({ name: 'writer', description: 'other', instructions: 'other' });
    await assert.rejects(() => skillsA.createSkill({ name: 'writer', description: 'dup', instructions: 'dup' }), /duplicate key|unique/i);

    await autoA.createAutomation({ ...scheduleRequest('daily-recap', '2026-07-04T09:00:00.000Z'), kind: 'conversation', trigger: { phrases: ['mine'] }, nextRunAt: null });
    await autoB.createAutomation({ ...scheduleRequest('daily-recap', '2026-07-04T09:00:00.000Z'), kind: 'conversation', trigger: { phrases: ['other'] }, nextRunAt: null });

    assert.equal(await skillsA.getSkill(other.id), null);
    assert.equal(await skillsB.getSkill(mine.id), null);
    assert.deepEqual((await skillsA.listSkills()).map((skill) => skill.description), ['mine']);
    assert.deepEqual((await autoA.listAutomations()).map((automation) => automation.action.prompt), ['Summarize']);
    assert.equal(await autoA.deleteAutomation((await autoB.listAutomations())[0].id), false);
  });
});

postgresTest('preserves calendar recurrence operations and undo rollback semantics', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const calendar = createPostgresCalendarRepository(ownerA, pool);
    const bootstrap = await calendar.bootstrap();
    const calendarId = bootstrap.calendars[0].id;

    const event = await calendar.createEvent({
      calendarId,
      title: 'Standup',
      startsAt: '2026-07-04T09:00:00.000Z',
      endsAt: '2026-07-04T09:30:00.000Z',
      recurrence: { frequency: 'DAILY', interval: 1, count: 3 },
    });
    assert.equal(event.recurrence?.frequency, 'DAILY');
    assert.deepEqual((await calendar.listEvents('2026-07-04T00:00:00.000Z', '2026-07-08T00:00:00.000Z')).map((item) => item.startsAt), [
      '2026-07-04T09:00:00.000Z',
      '2026-07-05T09:00:00.000Z',
      '2026-07-06T09:00:00.000Z',
    ]);
    await calendar.saveOccurrence(event.id, '2026-07-05T09:00:00.000Z', 'cancel', null);
    assert.deepEqual((await calendar.listEvents('2026-07-04T00:00:00.000Z', '2026-07-08T00:00:00.000Z')).map((item) => item.startsAt), [
      '2026-07-04T09:00:00.000Z',
      '2026-07-06T09:00:00.000Z',
    ]);

    const task = await calendar.createTask({ title: 'Ship calendar', dueDate: '2026-07-04', priority: 'high' });
    await calendar.updateTask(task.id, { title: task.title, notes: task.notes, dueDate: task.dueDate, dueAt: task.dueAt, priority: task.priority, completedAt: '2026-07-04T15:00:00.000Z' });
    assert.equal((await calendar.listTasks()).find((item) => item.id === task.id)?.completedAt, '2026-07-04T15:00:00.000Z');
    assert.equal(await calendar.undoLast(), true);
    assert.equal((await calendar.listTasks()).find((item) => item.id === task.id)?.completedAt, null);
  });
});

postgresTest('preserves workout routine/session/set atomicity and completion behavior', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const workout = createPostgresWorkoutRepository(ownerA, pool, () => '2026-07-04T12:00:00.000Z');
    const otherWorkout = createPostgresWorkoutRepository(ownerB, pool, () => '2026-07-04T12:00:00.000Z');
    const exercises = (await workout.bootstrap()).exercises.slice(0, 2);
    const routine = await workout.saveRoutine(null, { name: 'Push', exercises: exercises.map((exercise, index) => ({ exerciseId: exercise.id, orderIndex: index, targetSets: 2 })) });
    const session = await workout.startRoutineSession(routine.id);

    assert.equal(session?.exercises.length, 2);
    assert.equal(session?.exercises[0].sets.length, 2);
    assert.equal(await otherWorkout.getSession(session!.id), null);

    const finished = await workout.finishSession({ ...session!, finishedAt: '2026-07-04T13:00:00.000Z' });
    assert.equal(finished?.finishedAt, '2026-07-04T13:00:00.000Z');
    assert.equal((await workout.activeSession()), null);
    assert.equal((await workout.listFinishedSessions({ limit: 10 }))[0].id, session?.id);
  });
});

postgresTest('preserves nutrition recipe, diary, usage-stat, and ordering behavior', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const nutrition = createPostgresNutritionRepository(ownerA, pool, () => '2026-07-04T12:00:00.000Z');
    const otherNutrition = createPostgresNutritionRepository(ownerB, pool, () => '2026-07-04T12:00:00.000Z');
    await nutrition.ensureDefaults();
    await otherNutrition.ensureDefaults();

    const crackers = await nutrition.saveBrandFood(null, { name: 'Cheese Crackers', brandName: 'Snack Co', barcodeText: '12345', servings: [{ id: 'serving_box', label: '1 box', amount: 1, grams: 30 }], nutritionPer100g: { calories: 500, proteinG: 9, carbsG: 61, fatG: 24 } });
    const recipe = await nutrition.saveRecipe(null, { name: 'Apple Cracker Bowl', servings: 2, ingredients: [{ foodId: 'food_apple', amountG: 180 }, { foodId: crackers.id, amountG: 30 }] });
    const breakfast = await nutrition.saveDiaryEntry(null, { loggedAt: '2026-07-04T08:00:00.000Z', note: 'Breakfast', items: [{ itemType: 'food', itemId: 'food_apple', quantity: 1, unit: 'serving', servingId: 'serving_1_cup' }] });
    await nutrition.saveDiaryEntry(null, { loggedAt: '2026-07-03T12:00:00.000Z', note: 'Lunch', items: [{ itemType: 'recipe', itemId: recipe.id, quantity: 1, unit: 'serving' }] });

    assert.equal(recipe.ingredients.length, 2);
    assert.equal(Math.round(recipe.totalWeightG), 210);
    assert.deepEqual((await nutrition.listDiaryEntries({ startDate: '2026-07-03', endDate: '2026-07-04' })).map((entry) => entry.note), ['Breakfast', 'Lunch']);
    assert.equal((await nutrition.searchItems('', '2026-07-04T08:30:00.000Z'))[0].name, 'Apple');
    assert.deepEqual(await otherNutrition.listDiaryEntries({ date: '2026-07-04' }), []);
    assert.equal(await otherNutrition.deleteDiaryEntry(breakfast.id), false);
  });
});

postgresTest('claims scheduled automations once under concurrent callers and reports runs', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const firstRepo = createPostgresAutomationsRepository(ownerA, pool);
    const secondRepo = createPostgresAutomationsRepository(ownerA, pool);
    const due = await firstRepo.createAutomation(scheduleRequest('daily-recap', '2026-07-04T09:00:00.000Z'));
    await firstRepo.createAutomation(scheduleRequest('later-recap', '2026-07-05T09:00:00.000Z'));

    const resolveClaim = () => ({ claimedRunAt: '2026-07-04T09:00:00.000Z', nextRunAt: '2026-07-05T09:00:00.000Z' });
    const [first, second] = await Promise.all([
      firstRepo.claimDue('2026-07-04T10:00:00.000Z', resolveClaim),
      secondRepo.claimDue('2026-07-04T10:00:00.000Z', resolveClaim),
    ]);
    const claimed = [...first, ...second];

    assert.deepEqual(claimed.map((run) => run.automation.id), [due.id]);
    assert.equal((await firstRepo.getAutomation(due.id))?.lastRunStatus, 'running');
    const reported = await firstRepo.reportRun(due.id, { status: 'success', summary: 'Done.', chatId: 'chat-1', completedAt: '2026-07-04T10:05:00.000Z' });
    assert.equal(reported?.lastRunStatus, 'success');
    assert.equal(reported?.lastChatId, 'chat-1');
  });
});

postgresTest('rolls back failed compound writes', async () => {
  await withPool(async (pool) => {
    await applyFreshMigration(pool);
    const workout = createPostgresWorkoutRepository(ownerA, pool, () => '2026-07-04T12:00:00.000Z');
    await workout.bootstrap();

    await assert.rejects(() => workout.saveRoutine(null, { name: 'Broken', exercises: [{ exerciseId: 'missing-exercise', orderIndex: 0, targetSets: 3 }] }));
    assert.equal((await workout.listRoutines()).some((routine) => routine.name === 'Broken'), false);

    const nutrition = createPostgresNutritionRepository(ownerA, pool, () => '2026-07-04T12:00:00.000Z');
    await nutrition.ensureDefaults();
    await assert.rejects(() => nutrition.saveDiaryEntry(null, { loggedAt: '2026-07-04T12:00:00.000Z', items: [{ itemType: 'food', itemId: 'missing-food', quantity: 1, unit: 'gram' }] }));
    assert.deepEqual(await nutrition.listDiaryEntries({ date: '2026-07-04' }), []);
  });
});
