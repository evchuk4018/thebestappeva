import dotenv from 'dotenv';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { Pool, type PoolClient } from 'pg';

dotenv.config({ quiet: true });

type SqliteValue = string | number | null;
type SqliteRow = Record<string, SqliteValue>;
type PgValue = string | number | boolean | null;

type ColumnKind = 'text' | 'integer' | 'number' | 'boolean' | 'json' | 'timestamp' | 'date' | 'uuid';

interface ColumnSpec {
  name: string;
  kind: ColumnKind;
  nullable?: boolean;
}

interface TableSpec {
  name: string;
  identity: string[];
  columns: ColumnSpec[];
  optionalSource?: boolean;
}

interface SourceTableSnapshot {
  rows: SqliteRow[];
  identities: string[];
  timestampRanges: Record<string, TimestampRange>;
}

interface VerificationResult {
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  sourceCounts: Record<string, number>;
  targetCounts: Record<string, number>;
  aggregateCounts: Record<string, number>;
  rowsWritten: number;
}

interface TimestampRange {
  min: string | null;
  max: string | null;
}

const legacyOwnerIds = new Set(['owner-local-default', 'local-user']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tables: TableSpec[] = [
  {
    name: 'app_settings',
    identity: ['key'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'key', kind: 'text' },
      { name: 'value_json', kind: 'json' },
    ],
  },
  {
    name: 'ai_chats',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'title', kind: 'text' },
      { name: 'mode', kind: 'text' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'payload_json', kind: 'json' },
    ],
  },
  {
    name: 'docs_documents',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'title', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'last_opened_at', kind: 'timestamp' },
      { name: 'starred', kind: 'boolean' },
      { name: 'trashed_at', kind: 'timestamp', nullable: true },
      { name: 'template_id', kind: 'text' },
      { name: 'active_tab_id', kind: 'text' },
      { name: 'layout_mode', kind: 'text' },
      { name: 'zoom', kind: 'number' },
      { name: 'page_settings_json', kind: 'json' },
    ],
  },
  {
    name: 'docs_tabs',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'document_id', kind: 'text' },
      { name: 'parent_tab_id', kind: 'text', nullable: true },
      { name: 'title', kind: 'text' },
      { name: 'tab_order', kind: 'integer' },
      { name: 'outline_visible', kind: 'boolean' },
      { name: 'content', kind: 'text' },
      { name: 'content_format', kind: 'text' },
      { name: 'text_content', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'docs_versions',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'document_id', kind: 'text' },
      { name: 'tab_id', kind: 'text', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'label', kind: 'text' },
      { name: 'kind', kind: 'text' },
      { name: 'content', kind: 'text' },
      { name: 'content_format', kind: 'text' },
      { name: 'snapshot_title', kind: 'text' },
    ],
  },
  {
    name: 'docs_citations',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'document_id', kind: 'text' },
      { name: 'label', kind: 'text' },
      { name: 'details', kind: 'text' },
    ],
  },
  {
    name: 'docs_migration_sources',
    identity: ['source_key'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'source_key', kind: 'text' },
      { name: 'imported_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'ai_artifacts',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'chat_id', kind: 'text' },
      { name: 'title', kind: 'text' },
      { name: 'type', kind: 'text' },
      { name: 'schema_version', kind: 'integer' },
      { name: 'content_markdown', kind: 'text' },
      { name: 'context_policy_json', kind: 'json' },
      { name: 'citations_json', kind: 'json' },
      { name: 'linked_doc_id', kind: 'text', nullable: true },
      { name: 'last_exported_at', kind: 'timestamp', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'ai_artifact_versions',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'artifact_id', kind: 'text' },
      { name: 'title', kind: 'text' },
      { name: 'type', kind: 'text' },
      { name: 'content_markdown', kind: 'text' },
      { name: 'context_policy_json', kind: 'json' },
      { name: 'citations_json', kind: 'json' },
      { name: 'linked_doc_id', kind: 'text', nullable: true },
      { name: 'last_exported_at', kind: 'timestamp', nullable: true },
      { name: 'actor', kind: 'text' },
      { name: 'reason', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'skills',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'description', kind: 'text' },
      { name: 'instructions', kind: 'text' },
      { name: 'enabled', kind: 'boolean' },
      { name: 'compatible_modes_json', kind: 'json' },
      { name: 'metadata_json', kind: 'json' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'automations',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'description', kind: 'text' },
      { name: 'kind', kind: 'text' },
      { name: 'trigger_json', kind: 'json' },
      { name: 'action_json', kind: 'json' },
      { name: 'enabled', kind: 'boolean' },
      { name: 'next_run_at', kind: 'timestamp', nullable: true },
      { name: 'last_triggered_at', kind: 'timestamp', nullable: true },
      { name: 'last_completed_at', kind: 'timestamp', nullable: true },
      { name: 'last_run_status', kind: 'text' },
      { name: 'last_run_summary', kind: 'text', nullable: true },
      { name: 'last_error', kind: 'text', nullable: true },
      { name: 'last_chat_id', kind: 'text', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'workspace_revision_state',
    identity: ['workspace_key'],
    optionalSource: true,
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'workspace_key', kind: 'text' },
      { name: 'revision', kind: 'integer' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'state_json', kind: 'json' },
    ],
  },
  {
    name: 'calendar_calendars',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'color', kind: 'text' },
      { name: 'visible', kind: 'boolean' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'trashed_at', kind: 'timestamp', nullable: true },
    ],
  },
  {
    name: 'calendar_categories',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'calendar_id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'color', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'trashed_at', kind: 'timestamp', nullable: true },
    ],
  },
  {
    name: 'calendar_events',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'calendar_id', kind: 'text' },
      { name: 'category_id', kind: 'text', nullable: true },
      { name: 'title', kind: 'text' },
      { name: 'notes', kind: 'text' },
      { name: 'location', kind: 'text' },
      { name: 'timezone', kind: 'text' },
      { name: 'starts_at', kind: 'timestamp' },
      { name: 'ends_at', kind: 'timestamp' },
      { name: 'all_day', kind: 'boolean' },
      { name: 'start_date', kind: 'date', nullable: true },
      { name: 'end_date', kind: 'date', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'trashed_at', kind: 'timestamp', nullable: true },
    ],
  },
  {
    name: 'calendar_recurrence_rules',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'target_kind', kind: 'text' },
      { name: 'target_id', kind: 'text' },
      { name: 'frequency', kind: 'text' },
      { name: 'interval_count', kind: 'integer' },
      { name: 'count_limit', kind: 'integer', nullable: true },
      { name: 'until_at', kind: 'timestamp', nullable: true },
      { name: 'by_weekday_json', kind: 'json' },
      { name: 'rrule_text', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'calendar_recurrence_exceptions',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'event_id', kind: 'text' },
      { name: 'occurrence_key', kind: 'text' },
      { name: 'action', kind: 'text' },
      { name: 'override_json', kind: 'json', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'calendar_tasks',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'category_id', kind: 'text', nullable: true },
      { name: 'title', kind: 'text' },
      { name: 'notes', kind: 'text' },
      { name: 'due_at', kind: 'timestamp', nullable: true },
      { name: 'due_date', kind: 'date', nullable: true },
      { name: 'timezone', kind: 'text' },
      { name: 'priority', kind: 'text' },
      { name: 'completed_at', kind: 'timestamp', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'trashed_at', kind: 'timestamp', nullable: true },
    ],
  },
  {
    name: 'calendar_task_recurrence_rules',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'task_id', kind: 'text' },
      { name: 'frequency', kind: 'text' },
      { name: 'interval_count', kind: 'integer' },
      { name: 'count_limit', kind: 'integer', nullable: true },
      { name: 'until_at', kind: 'timestamp', nullable: true },
      { name: 'by_weekday_json', kind: 'json' },
      { name: 'rrule_text', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'calendar_settings',
    identity: [],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'timezone', kind: 'text' },
      { name: 'week_start', kind: 'text' },
      { name: 'hour_cycle', kind: 'text' },
      { name: 'working_hours_start', kind: 'text' },
      { name: 'working_hours_end', kind: 'text' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'calendar_undo_actions',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'action_kind', kind: 'text' },
      { name: 'entity_kind', kind: 'text' },
      { name: 'entity_id', kind: 'text' },
      { name: 'before_json', kind: 'json', nullable: true },
      { name: 'after_json', kind: 'json', nullable: true },
      { name: 'created_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'workout_exercises',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'category', kind: 'text' },
      { name: 'equipment', kind: 'text' },
      { name: 'is_preset', kind: 'boolean' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'workout_routines',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
      { name: 'archived_at', kind: 'timestamp', nullable: true },
    ],
  },
  {
    name: 'workout_routine_exercises',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'routine_id', kind: 'text' },
      { name: 'exercise_id', kind: 'text' },
      { name: 'order_index', kind: 'integer' },
      { name: 'target_sets', kind: 'integer' },
      { name: 'created_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'workout_sessions',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'routine_id', kind: 'text', nullable: true },
      { name: 'name', kind: 'text' },
      { name: 'started_at', kind: 'timestamp' },
      { name: 'finished_at', kind: 'timestamp', nullable: true },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'workout_session_exercises',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'session_id', kind: 'text' },
      { name: 'exercise_id', kind: 'text' },
      { name: 'order_index', kind: 'integer' },
      { name: 'notes', kind: 'text' },
    ],
  },
  {
    name: 'workout_sets',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'session_exercise_id', kind: 'text' },
      { name: 'set_index', kind: 'integer' },
      { name: 'rir', kind: 'number', nullable: true },
      { name: 'reps', kind: 'number', nullable: true },
      { name: 'weight', kind: 'number', nullable: true },
      { name: 'completed', kind: 'boolean' },
    ],
  },
  {
    name: 'nutrition_foods',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'source_type', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'brand_name', kind: 'text', nullable: true },
      { name: 'barcode_text', kind: 'text', nullable: true },
      { name: 'servings_json', kind: 'json' },
      { name: 'calories_per_100g', kind: 'number' },
      { name: 'protein_g_per_100g', kind: 'number' },
      { name: 'carbs_g_per_100g', kind: 'number' },
      { name: 'fat_g_per_100g', kind: 'number' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'nutrition_recipes',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'name', kind: 'text' },
      { name: 'note', kind: 'text' },
      { name: 'servings', kind: 'number' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'nutrition_recipe_ingredients',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'recipe_id', kind: 'text' },
      { name: 'food_id', kind: 'text' },
      { name: 'amount_g', kind: 'number' },
      { name: 'order_index', kind: 'integer' },
    ],
  },
  {
    name: 'nutrition_diary_entries',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'logged_at', kind: 'timestamp' },
      { name: 'note', kind: 'text' },
      { name: 'created_at', kind: 'timestamp' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'nutrition_diary_items',
    identity: ['id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'id', kind: 'text' },
      { name: 'entry_id', kind: 'text' },
      { name: 'item_type', kind: 'text' },
      { name: 'item_id', kind: 'text' },
      { name: 'quantity', kind: 'number' },
      { name: 'unit', kind: 'text' },
      { name: 'amount_g', kind: 'number' },
      { name: 'serving_id', kind: 'text', nullable: true },
      { name: 'serving_label', kind: 'text', nullable: true },
    ],
  },
  {
    name: 'nutrition_goals',
    identity: [],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'calories_target', kind: 'number' },
      { name: 'protein_target_g', kind: 'number' },
      { name: 'carbs_target_g', kind: 'number' },
      { name: 'fat_target_g', kind: 'number' },
      { name: 'updated_at', kind: 'timestamp' },
    ],
  },
  {
    name: 'nutrition_usage_stats',
    identity: ['item_type', 'item_id'],
    columns: [
      { name: 'owner_id', kind: 'uuid' },
      { name: 'item_type', kind: 'text' },
      { name: 'item_id', kind: 'text' },
      { name: 'use_count', kind: 'integer' },
      { name: 'last_used_at', kind: 'timestamp' },
      { name: 'morning_count', kind: 'integer' },
      { name: 'midday_count', kind: 'integer' },
      { name: 'evening_count', kind: 'integer' },
      { name: 'latenight_count', kind: 'integer' },
    ],
  },
];

const expectedPgTypes = new Map<ColumnKind, string[]>([
  ['boolean', ['boolean']],
  ['date', ['date']],
  ['integer', ['integer', 'bigint']],
  ['json', ['jsonb']],
  ['number', ['double precision', 'numeric']],
  ['text', ['text']],
  ['timestamp', ['timestamp with time zone']],
  ['uuid', ['uuid']],
]);

function usage() {
  console.log([
    'Usage: npm run db:migrate-to-postgres -- --owner-id <supabase-owner-uuid> [--dry-run]',
    '',
    'Environment:',
    '  LOCAL_DB_PATH   SQLite source path; defaults to .local-data/thebestappeva.sqlite',
    '  DATABASE_URL    Postgres destination connection URL',
  ].join('\n'));
}

function parseArgs(argv: string[]) {
  const result = { dryRun: false, ownerId: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (arg === '--owner-id') {
      result.ownerId = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!uuidPattern.test(result.ownerId)) {
    throw new Error('Missing or invalid --owner-id. Provide the destination Supabase owner UUID explicitly.');
  }
  return result;
}

function quoteSqliteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quotePgIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function tableExists(database: BetterSqlite3.Database, tableName: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function readSourceRows(database: BetterSqlite3.Database, spec: TableSpec): SqliteRow[] {
  if (!tableExists(database, spec.name)) {
    if (spec.optionalSource) return [];
    throw new Error(`Source SQLite schema is missing required table ${spec.name}.`);
  }

  const sourceColumns = new Set(
    (database.prepare(`PRAGMA table_info(${quoteSqliteIdentifier(spec.name)})`).all() as Array<{ name: string }>).map((column) => column.name),
  );
  const missingColumns = spec.columns.filter((column) => !sourceColumns.has(column.name));
  if (missingColumns.length) {
    throw new Error(`Source SQLite schema is incompatible for ${spec.name}: missing ${missingColumns.map((column) => column.name).join(', ')}.`);
  }

  return database.prepare(`SELECT ${spec.columns.map((column) => quoteSqliteIdentifier(column.name)).join(', ')} FROM ${quoteSqliteIdentifier(spec.name)}`).all() as SqliteRow[];
}

function identityForRow(spec: TableSpec, row: Record<string, unknown>, ownerId: string) {
  const parts = spec.identity.length ? spec.identity.map((column) => String(row[column] ?? '')) : ['__owner__'];
  return [ownerId, ...parts].join('\u001f');
}

function timestampColumns(spec: TableSpec) {
  return spec.columns.filter((column) => column.kind === 'timestamp' || column.kind === 'date').map((column) => column.name);
}

function normalizeTimestamp(value: unknown, tableName: string, columnName: string) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp in ${tableName}.${columnName} for a source row.`);
  }
  return date.toISOString();
}

function normalizeDate(value: unknown, tableName: string, columnName: string) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error(`Invalid date in ${tableName}.${columnName} for a source row.`);
  }
  return text;
}

function convertValue(spec: TableSpec, column: ColumnSpec, row: SqliteRow, ownerId: string): PgValue {
  const value = row[column.name];
  if (column.name === 'owner_id') {
    if (typeof value === 'string' && (legacyOwnerIds.has(value) || value === ownerId)) return ownerId;
    throw new Error(`Source owner_id in ${spec.name} cannot be mapped to the destination owner.`);
  }
  if (value === null || value === undefined) {
    if (column.nullable) return null;
    throw new Error(`Required source value is missing in ${spec.name}.${column.name} for a source row.`);
  }
  if (column.kind === 'boolean') {
    if (value === 0 || value === 1) return Boolean(value);
    if (typeof value === 'boolean') return value;
    throw new Error(`Invalid integer boolean in ${spec.name}.${column.name} for a source row.`);
  }
  if (column.kind === 'integer') {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue)) throw new Error(`Invalid integer in ${spec.name}.${column.name} for a source row.`);
    return numberValue;
  }
  if (column.kind === 'number') {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) throw new Error(`Invalid number in ${spec.name}.${column.name} for a source row.`);
    return numberValue;
  }
  if (column.kind === 'json') {
    try {
      JSON.parse(String(value));
    } catch {
      throw new Error(`Invalid JSON in ${spec.name}.${column.name} for a source row.`);
    }
    return String(value);
  }
  if (column.kind === 'timestamp') return normalizeTimestamp(value, spec.name, column.name);
  if (column.kind === 'date') return normalizeDate(value, spec.name, column.name);
  return String(value);
}

function createUpsertSql(spec: TableSpec) {
  const columns = spec.columns.map((column) => column.name);
  const placeholders = spec.columns.map((column, index) => {
    const parameter = `$${index + 1}`;
    if (column.kind === 'json') return `${parameter}::jsonb`;
    if (column.kind === 'uuid') return `${parameter}::uuid`;
    return parameter;
  });
  const conflictColumns = ['owner_id', ...spec.identity];
  const updateColumns = columns.filter((column) => !conflictColumns.includes(column));
  const updateSql = updateColumns.length
    ? `DO UPDATE SET ${updateColumns.map((column) => `${quotePgIdentifier(column)} = excluded.${quotePgIdentifier(column)}`).join(', ')}`
    : 'DO NOTHING';

  return `
    INSERT INTO ${quotePgIdentifier(spec.name)} (${columns.map(quotePgIdentifier).join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT(${conflictColumns.map(quotePgIdentifier).join(', ')}) ${updateSql}
  `;
}

function timestampRangeForRows(spec: TableSpec, rows: SqliteRow[], ownerId: string) {
  const ranges: Record<string, TimestampRange> = {};
  for (const column of timestampColumns(spec)) {
    const values = rows.map((row) => {
      const columnSpec = spec.columns.find((entry) => entry.name === column)!;
      return columnSpec.kind === 'date'
        ? normalizeDate(row[column], spec.name, column)
        : normalizeTimestamp(row[column], spec.name, column);
    }).filter((value): value is string => Boolean(value)).sort();
    ranges[column] = { min: values[0] ?? null, max: values.at(-1) ?? null };
  }
  return ranges;
}

function loadSource(database: BetterSqlite3.Database, ownerId: string) {
  const source = new Map<string, SourceTableSnapshot>();
  for (const spec of tables) {
    const rows = readSourceRows(database, spec);
    const identities = rows.map((row) => identityForRow(spec, row, ownerId)).sort();
    const duplicate = identities.find((identity, index) => index > 0 && identities[index - 1] === identity);
    if (duplicate) throw new Error(`Duplicate source identity detected in ${spec.name}.`);
    source.set(spec.name, {
      rows,
      identities,
      timestampRanges: timestampRangeForRows(spec, rows, ownerId),
    });
  }
  return source;
}

async function assertTargetSchema(client: PoolClient) {
  const schemaRows = await client.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `);
  const schema = new Map<string, Map<string, { dataType: string; nullable: boolean }>>();
  for (const row of schemaRows.rows) {
    const table = schema.get(row.table_name) ?? new Map<string, { dataType: string; nullable: boolean }>();
    table.set(row.column_name, { dataType: row.data_type, nullable: row.is_nullable === 'YES' });
    schema.set(row.table_name, table);
  }

  for (const spec of tables) {
    const table = schema.get(spec.name);
    if (!table) throw new Error(`Target Postgres schema is incompatible: missing table ${spec.name}.`);
    for (const column of spec.columns) {
      const actual = table.get(column.name);
      if (!actual) throw new Error(`Target Postgres schema is incompatible: missing ${spec.name}.${column.name}.`);
      const allowedTypes = expectedPgTypes.get(column.kind) ?? [];
      if (!allowedTypes.includes(actual.dataType)) {
        throw new Error(`Target Postgres schema is incompatible: ${spec.name}.${column.name} has ${actual.dataType}.`);
      }
      if (!column.nullable && actual.nullable) {
        throw new Error(`Target Postgres schema is incompatible: ${spec.name}.${column.name} is nullable.`);
      }
    }
  }
}

async function importRows(client: PoolClient, source: Map<string, SourceTableSnapshot>, ownerId: string) {
  let rowsWritten = 0;
  for (const spec of tables) {
    const rows = source.get(spec.name)?.rows ?? [];
    if (!rows.length) continue;
    const sql = createUpsertSql(spec);
    for (const row of rows) {
      const values = spec.columns.map((column) => convertValue(spec, column, row, ownerId));
      await client.query(sql, values);
      rowsWritten += 1;
    }
  }
  return rowsWritten;
}

async function targetCount(client: PoolClient, spec: TableSpec, ownerId: string) {
  const result = await client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${quotePgIdentifier(spec.name)} WHERE owner_id = $1`, [ownerId]);
  return Number(result.rows[0].count);
}

async function targetIdentities(client: PoolClient, spec: TableSpec, ownerId: string) {
  const columns = spec.identity.length ? spec.identity.map(quotePgIdentifier).join(', ') : `'__owner__' AS identity_only`;
  const order = spec.identity.length ? spec.identity.map(quotePgIdentifier).join(', ') : 'owner_id';
  const result = await client.query<Record<string, unknown>>(
    `SELECT ${columns} FROM ${quotePgIdentifier(spec.name)} WHERE owner_id = $1 ORDER BY ${order}`,
    [ownerId],
  );
  return result.rows.map((row) => identityForRow(spec, row, ownerId)).sort();
}

async function targetTimestampRanges(client: PoolClient, spec: TableSpec, ownerId: string) {
  const ranges: Record<string, TimestampRange> = {};
  for (const column of timestampColumns(spec)) {
    const result = await client.query<{ min_value: Date | string | null; max_value: Date | string | null }>(`
      SELECT MIN(${quotePgIdentifier(column)}) AS min_value, MAX(${quotePgIdentifier(column)}) AS max_value
      FROM ${quotePgIdentifier(spec.name)}
      WHERE owner_id = $1
    `, [ownerId]);
    ranges[column] = {
      min: result.rows[0].min_value instanceof Date ? result.rows[0].min_value.toISOString() : result.rows[0].min_value ? String(result.rows[0].min_value) : null,
      max: result.rows[0].max_value instanceof Date ? result.rows[0].max_value.toISOString() : result.rows[0].max_value ? String(result.rows[0].max_value) : null,
    };
  }
  return ranges;
}

function mapsEqual(left: Record<string, number>, right: Record<string, number>) {
  const leftEntries = Object.entries(left).sort();
  const rightEntries = Object.entries(right).sort();
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function identitySetsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceGroupCount(source: Map<string, SourceTableSnapshot>, tableName: string, groupColumn: string) {
  const counts: Record<string, number> = {};
  for (const row of source.get(tableName)?.rows ?? []) {
    const key = String(row[groupColumn] ?? '');
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function targetGroupCount(client: PoolClient, tableName: string, groupColumn: string, ownerId: string) {
  const result = await client.query<{ group_key: string; count: string }>(`
    SELECT ${quotePgIdentifier(groupColumn)}::text AS group_key, COUNT(*) AS count
    FROM ${quotePgIdentifier(tableName)}
    WHERE owner_id = $1
    GROUP BY ${quotePgIdentifier(groupColumn)}
  `, [ownerId]);
  return Object.fromEntries(result.rows.map((row) => [row.group_key, Number(row.count)]));
}

async function countInvalidReferences(client: PoolClient, ownerId: string) {
  const checks = [
    `SELECT COUNT(*) AS count FROM ai_artifact_versions child LEFT JOIN ai_artifacts parent ON parent.owner_id = child.owner_id AND parent.id = child.artifact_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM docs_tabs child LEFT JOIN docs_documents parent ON parent.owner_id = child.owner_id AND parent.id = child.document_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM docs_versions child LEFT JOIN docs_documents parent ON parent.owner_id = child.owner_id AND parent.id = child.document_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM docs_versions child LEFT JOIN docs_tabs parent ON parent.owner_id = child.owner_id AND parent.id = child.tab_id WHERE child.owner_id = $1 AND child.tab_id IS NOT NULL AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM docs_citations child LEFT JOIN docs_documents parent ON parent.owner_id = child.owner_id AND parent.id = child.document_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM calendar_categories child LEFT JOIN calendar_calendars parent ON parent.owner_id = child.owner_id AND parent.id = child.calendar_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM calendar_events child LEFT JOIN calendar_calendars parent ON parent.owner_id = child.owner_id AND parent.id = child.calendar_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM calendar_events child LEFT JOIN calendar_categories parent ON parent.owner_id = child.owner_id AND parent.id = child.category_id WHERE child.owner_id = $1 AND child.category_id IS NOT NULL AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM calendar_recurrence_exceptions child LEFT JOIN calendar_events parent ON parent.owner_id = child.owner_id AND parent.id = child.event_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM calendar_tasks child LEFT JOIN calendar_categories parent ON parent.owner_id = child.owner_id AND parent.id = child.category_id WHERE child.owner_id = $1 AND child.category_id IS NOT NULL AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM calendar_task_recurrence_rules child LEFT JOIN calendar_tasks parent ON parent.owner_id = child.owner_id AND parent.id = child.task_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM workout_routine_exercises child LEFT JOIN workout_routines parent ON parent.owner_id = child.owner_id AND parent.id = child.routine_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM workout_routine_exercises child LEFT JOIN workout_exercises parent ON parent.owner_id = child.owner_id AND parent.id = child.exercise_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM workout_session_exercises child LEFT JOIN workout_sessions parent ON parent.owner_id = child.owner_id AND parent.id = child.session_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM workout_session_exercises child LEFT JOIN workout_exercises parent ON parent.owner_id = child.owner_id AND parent.id = child.exercise_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM workout_sets child LEFT JOIN workout_session_exercises parent ON parent.owner_id = child.owner_id AND parent.id = child.session_exercise_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM nutrition_recipe_ingredients child LEFT JOIN nutrition_recipes parent ON parent.owner_id = child.owner_id AND parent.id = child.recipe_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM nutrition_recipe_ingredients child LEFT JOIN nutrition_foods parent ON parent.owner_id = child.owner_id AND parent.id = child.food_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
    `SELECT COUNT(*) AS count FROM nutrition_diary_items child LEFT JOIN nutrition_diary_entries parent ON parent.owner_id = child.owner_id AND parent.id = child.entry_id WHERE child.owner_id = $1 AND parent.id IS NULL`,
  ];
  let invalid = 0;
  for (const sql of checks) {
    const result = await client.query<{ count: string }>(sql, [ownerId]);
    invalid += Number(result.rows[0].count);
  }
  return invalid;
}

async function verifyMigration(client: PoolClient, source: Map<string, SourceTableSnapshot>, ownerId: string, rowsWritten: number): Promise<VerificationResult> {
  const checks: VerificationResult['checks'] = [];
  const sourceCounts: Record<string, number> = {};
  const targetCounts: Record<string, number> = {};

  for (const spec of tables) {
    const sourceSnapshot = source.get(spec.name)!;
    const sourceCount = sourceSnapshot.rows.length;
    const nextTargetCount = await targetCount(client, spec, ownerId);
    sourceCounts[spec.name] = sourceCount;
    targetCounts[spec.name] = nextTargetCount;
    checks.push({ name: `${spec.name} row count`, ok: sourceCount === nextTargetCount, detail: `${sourceCount}` });

    const targetIds = await targetIdentities(client, spec, ownerId);
    checks.push({ name: `${spec.name} entity ids`, ok: identitySetsEqual(sourceSnapshot.identities, targetIds), detail: `${sourceSnapshot.identities.length}` });

    const targetRanges = await targetTimestampRanges(client, spec, ownerId);
    for (const [column, sourceRange] of Object.entries(sourceSnapshot.timestampRanges)) {
      const targetRange = targetRanges[column];
      checks.push({
        name: `${spec.name}.${column} min/max`,
        ok: sourceRange.min === targetRange.min && sourceRange.max === targetRange.max,
        detail: sourceRange.min || sourceRange.max ? 'non-empty range' : 'empty range',
      });
    }
  }

  checks.push({ name: 'owner ids', ok: true, detail: 'source owners mapped to destination owner' });

  const invalidReferences = await countInvalidReferences(client, ownerId);
  checks.push({ name: 'foreign-key validity', ok: invalidReferences === 0, detail: `${invalidReferences} invalid references` });

  const aggregateCounts = {
    documentTabs: sourceCounts.docs_tabs,
    documentVersions: sourceCounts.docs_versions,
    calendarRecurrenceRules: sourceCounts.calendar_recurrence_rules + sourceCounts.calendar_task_recurrence_rules,
    calendarExceptions: sourceCounts.calendar_recurrence_exceptions,
    workoutSessions: sourceCounts.workout_sessions,
    workoutSets: sourceCounts.workout_sets,
    nutritionEntries: sourceCounts.nutrition_diary_entries,
    nutritionItems: sourceCounts.nutrition_diary_items,
    skills: sourceCounts.skills,
    automations: sourceCounts.automations,
  };

  const groupedComparisons: Array<[string, string, string]> = [
    ['document tab counts', 'docs_tabs', 'document_id'],
    ['document version counts', 'docs_versions', 'document_id'],
    ['workout session exercise counts', 'workout_session_exercises', 'session_id'],
    ['workout set counts', 'workout_sets', 'session_exercise_id'],
    ['nutrition entry item counts', 'nutrition_diary_items', 'entry_id'],
    ['calendar exception counts', 'calendar_recurrence_exceptions', 'event_id'],
    ['calendar task recurrence counts', 'calendar_task_recurrence_rules', 'task_id'],
  ];

  for (const [name, tableName, groupColumn] of groupedComparisons) {
    checks.push({
      name,
      ok: mapsEqual(sourceGroupCount(source, tableName, groupColumn), await targetGroupCount(client, tableName, groupColumn, ownerId)),
      detail: 'grouped counts match',
    });
  }

  checks.push({ name: 'JSON validity', ok: true, detail: 'source JSON parsed and target JSONB accepted' });

  return { checks, sourceCounts, targetCounts, aggregateCounts, rowsWritten };
}

function printReport(result: VerificationResult, dryRun: boolean) {
  const ok = result.checks.every((check) => check.ok);
  console.log(`Migration mode: ${dryRun ? 'dry-run' : 'import'}`);
  console.log(`Rows processed: ${result.rowsWritten}`);
  console.log(`Verification status: ${ok ? 'PASSED' : 'FAILED'}`);
  console.log('Aggregate counts:');
  for (const [name, count] of Object.entries(result.aggregateCounts)) {
    console.log(`- ${name}: ${count}`);
  }
  console.log('Checks:');
  for (const check of result.checks) {
    console.log(`- ${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  }
  if (!ok) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required and must point at the Postgres destination.');

  const sourcePath = path.resolve(process.cwd(), process.env.LOCAL_DB_PATH?.trim() || '.local-data/thebestappeva.sqlite');
  const sqlite = new BetterSqlite3(sourcePath, { readonly: true, fileMustExist: true });
  sqlite.pragma('query_only = ON');
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();

  try {
    const source = loadSource(sqlite, args.ownerId);
    await assertTargetSchema(client);
    await client.query('BEGIN');
    let result: VerificationResult;
    try {
      const rowsWritten = await importRows(client, source, args.ownerId);
      result = await verifyMigration(client, source, args.ownerId, rowsWritten);
      if (args.dryRun) {
        await client.query('ROLLBACK');
      } else {
        if (!result.checks.every((check) => check.ok)) throw new Error('Migration verification failed; rolling back import.');
        await client.query('COMMIT');
      }
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
    printReport(result, args.dryRun);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Migration failed.';
  console.error(message);
  process.exit(1);
});
