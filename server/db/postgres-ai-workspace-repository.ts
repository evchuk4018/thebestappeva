import type { Pool, PoolClient } from 'pg';
import { AiPreferences, AiWorkspaceSnapshot, Chat, createEmptyAiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
import { HttpError } from '../http';
import { getPostgresPool } from './postgres';
import { createPostgresAppSettingsRepository } from './postgres-app-settings-repository';
import { assertOwnerUuid, normalizeJsonb, runPostgresTransaction, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

const selectedModelKey = 'ai.selected-model';
const selectedProviderKey = 'ai.selected-provider';
const visionModeKey = 'ai.vision-mode';
const enabledToolsKey = 'ai.enabled-tools';
const customSystemPromptKey = 'ai.custom-system-prompt';
const generatedUserMemoryKey = 'ai.generated-user-memory';
const workspaceRevisionKey = 'ai.workspace';

const defaultAiPreferences = { selectedProvider: 'ollama' as const, selectedModel: null, visionMode: 'offline' as const };

export class WorkspaceRevisionConflictError extends HttpError {
  constructor(expectedRevision: number, actualRevision: number) {
    super(409, `AI workspace revision conflict. Expected ${expectedRevision}, found ${actualRevision}.`);
    this.name = 'WorkspaceRevisionConflictError';
  }
}

function parseStoredChat(payload: unknown, chatId: string) {
  return parseAiWorkspaceSnapshot({
    chats: [normalizeJsonb(payload)],
    generatedUserMemory: '',
    selectedModel: null,
    enabledTools: {},
    customSystemPrompt: '',
  }, `Stored chat "${chatId}"`).chats[0];
}

async function selectStoredChats(executor: PostgresExecutor, ownerId: string): Promise<Chat[]> {
  const result = await executor.query('SELECT id, payload_json FROM ai_chats WHERE owner_id = $1 ORDER BY updated_at DESC, id DESC', [ownerId]);
  return result.rows.map((row) => parseStoredChat((row as { payload_json: unknown }).payload_json, String((row as { id: string }).id)));
}

async function ensureRevisionRow(client: PoolClient, ownerId: string) {
  await client.query(`
    INSERT INTO workspace_revision_state (owner_id, workspace_key, revision, updated_at, state_json)
    VALUES ($1, $2, 0, now(), '{}'::jsonb)
    ON CONFLICT(owner_id, workspace_key) DO NOTHING
  `, [ownerId, workspaceRevisionKey]);
}

async function readWorkspaceRevision(executor: PostgresExecutor, ownerId: string) {
  const result = await executor.query(
    'SELECT revision FROM workspace_revision_state WHERE owner_id = $1 AND workspace_key = $2',
    [ownerId, workspaceRevisionKey],
  );
  return Number((result.rows[0] as { revision: string | number } | undefined)?.revision ?? 0);
}

async function lockWorkspaceRevision(client: PoolClient, ownerId: string) {
  await ensureRevisionRow(client, ownerId);
  const result = await client.query(
    'SELECT revision FROM workspace_revision_state WHERE owner_id = $1 AND workspace_key = $2 FOR UPDATE',
    [ownerId, workspaceRevisionKey],
  );
  return Number((result.rows[0] as { revision: string | number }).revision);
}

async function incrementWorkspaceRevision(client: PoolClient, ownerId: string, currentRevision: number) {
  const nextRevision = currentRevision + 1;
  await client.query(`
    UPDATE workspace_revision_state
    SET revision = $3, updated_at = now()
    WHERE owner_id = $1 AND workspace_key = $2
  `, [ownerId, workspaceRevisionKey, nextRevision]);
  return nextRevision;
}

export function createPostgresAiWorkspaceRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
) {
  const validatedOwnerId = assertOwnerUuid(ownerId);

  function settingsRepository(nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    return createPostgresAppSettingsRepository(validatedOwnerId, nextExecutor);
  }

  async function loadGeneratedUserMemoryWithExecutor(nextExecutor: PostgresExecutor = executor as PostgresExecutor) {
    return settingsRepository(nextExecutor).readJsonSetting(generatedUserMemoryKey, (value, field) => parseAiWorkspaceSnapshot({
      ...createEmptyAiWorkspaceSnapshot(),
      generatedUserMemory: value,
    }, field).generatedUserMemory, '');
  }

  async function loadWorkspaceWithExecutor(nextExecutor: PostgresExecutor = executor as PostgresExecutor): Promise<AiWorkspaceSnapshot> {
    const settings = settingsRepository(nextExecutor);
    return {
      chats: await selectStoredChats(nextExecutor, validatedOwnerId),
      generatedUserMemory: await loadGeneratedUserMemoryWithExecutor(nextExecutor),
      selectedProvider: (await settings.readJsonSetting(selectedProviderKey, parseAiPreferences, defaultAiPreferences)).selectedProvider,
      selectedModel: (await settings.readJsonSetting(selectedModelKey, parseAiPreferences, defaultAiPreferences)).selectedModel,
      visionMode: (await settings.readJsonSetting(visionModeKey, parseAiPreferences, defaultAiPreferences)).visionMode,
      enabledTools: await settings.readJsonSetting(
        enabledToolsKey,
        (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), enabledTools: value }, field).enabledTools,
        {},
      ),
      customSystemPrompt: await settings.readJsonSetting(
        customSystemPromptKey,
        (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), customSystemPrompt: value }, field).customSystemPrompt,
        '',
      ),
    };
  }

  return {
    async loadAiWorkspace() {
      const [revision, workspace] = await Promise.all([
        readWorkspaceRevision(executor as PostgresExecutor, validatedOwnerId),
        loadWorkspaceWithExecutor(),
      ]);
      return { revision, workspace };
    },
    async loadAiPreferences(): Promise<AiPreferences> {
      const settings = settingsRepository();
      return {
        selectedProvider: (await settings.readJsonSetting(selectedProviderKey, parseAiPreferences, defaultAiPreferences)).selectedProvider,
        selectedModel: (await settings.readJsonSetting(selectedModelKey, parseAiPreferences, defaultAiPreferences)).selectedModel,
        visionMode: (await settings.readJsonSetting(visionModeKey, parseAiPreferences, defaultAiPreferences)).visionMode,
      };
    },
    loadGeneratedUserMemory: loadGeneratedUserMemoryWithExecutor,
    async saveGeneratedUserMemory(value: string) {
      await runPostgresTransaction(executor, async (client) => {
        const currentRevision = await lockWorkspaceRevision(client, validatedOwnerId);
        await settingsRepository(client).writeJsonSetting(generatedUserMemoryKey, value);
        await incrementWorkspaceRevision(client, validatedOwnerId, currentRevision);
      });
    },
    async findChatById(chatId: string) {
      const result = await (executor as PostgresExecutor).query('SELECT payload_json FROM ai_chats WHERE owner_id = $1 AND id = $2', [validatedOwnerId, chatId]);
      const row = result.rows[0] as { payload_json: unknown } | undefined;
      return row ? parseStoredChat(row.payload_json, chatId) : null;
    },
    async updateChatSummary(chatId: string, summary: string, summaryUpdatedAt: string | null) {
      return runPostgresTransaction(executor, async (client) => {
        const currentRevision = await lockWorkspaceRevision(client, validatedOwnerId);
        const result = await client.query('SELECT payload_json FROM ai_chats WHERE owner_id = $1 AND id = $2 FOR UPDATE', [validatedOwnerId, chatId]);
        const row = result.rows[0] as { payload_json: unknown } | undefined;
        if (!row) {
          return null;
        }

        const chat = parseStoredChat(row.payload_json, chatId);
        const nextChat = {
          ...chat,
          summary: summary || undefined,
          summaryUpdatedAt: summaryUpdatedAt ?? undefined,
        } satisfies Chat;
        await client.query(`
          UPDATE ai_chats
          SET title = $3,
              mode = $4,
              updated_at = $5,
              payload_json = $6::jsonb
          WHERE owner_id = $1 AND id = $2
        `, [validatedOwnerId, nextChat.id, nextChat.title, nextChat.mode, nextChat.updatedAt, toJsonbParam(nextChat)]);
        await incrementWorkspaceRevision(client, validatedOwnerId, currentRevision);
        return nextChat;
      });
    },
    async saveAiWorkspace(snapshot: AiWorkspaceSnapshot, expectedRevision: number) {
      return runPostgresTransaction(executor, async (client) => {
        const currentRevision = await lockWorkspaceRevision(client, validatedOwnerId);
        if (currentRevision !== expectedRevision) {
          throw new WorkspaceRevisionConflictError(expectedRevision, currentRevision);
        }

        for (const chat of snapshot.chats) {
          await client.query(`
            INSERT INTO ai_chats (owner_id, id, title, mode, updated_at, payload_json)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            ON CONFLICT(owner_id, id) DO UPDATE SET
              title = excluded.title,
              mode = excluded.mode,
              updated_at = excluded.updated_at,
              payload_json = excluded.payload_json
          `, [validatedOwnerId, chat.id, chat.title, chat.mode, chat.updatedAt, toJsonbParam(chat)]);
        }

        if (snapshot.chats.length) {
          await client.query('DELETE FROM ai_chats WHERE owner_id = $1 AND NOT (id = ANY($2::text[]))', [validatedOwnerId, snapshot.chats.map((chat) => chat.id)]);
        } else {
          await client.query('DELETE FROM ai_chats WHERE owner_id = $1', [validatedOwnerId]);
        }

        const settings = settingsRepository(client);
        await settings.writeJsonSetting(selectedProviderKey, { selectedProvider: snapshot.selectedProvider });
        await settings.writeJsonSetting(selectedModelKey, { selectedModel: snapshot.selectedModel });
        await settings.writeJsonSetting(visionModeKey, { visionMode: snapshot.visionMode });
        await settings.writeJsonSetting(enabledToolsKey, snapshot.enabledTools);
        await settings.writeJsonSetting(customSystemPromptKey, snapshot.customSystemPrompt);
        await settings.writeJsonSetting(generatedUserMemoryKey, snapshot.generatedUserMemory);

        const revision = await incrementWorkspaceRevision(client, validatedOwnerId, currentRevision);
        return { revision, workspace: snapshot };
      });
    },
  };
}
