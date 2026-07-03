import type BetterSqlite3 from 'better-sqlite3';
import { AiPreferences, AiWorkspaceSnapshot, Chat, createEmptyAiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
import { getCanonicalOwnerId } from '../ownership';
import { getDatabase } from './database';
import { createAppSettingsRepository } from './app-settings-repository';

const selectedModelKey = 'ai.selected-model';
const selectedProviderKey = 'ai.selected-provider';
const visionModeKey = 'ai.vision-mode';
const enabledToolsKey = 'ai.enabled-tools';
const customSystemPromptKey = 'ai.custom-system-prompt';
const generatedUserMemoryKey = 'ai.generated-user-memory';

const defaultAiPreferences = { selectedProvider: 'ollama' as const, selectedModel: null, visionMode: 'offline' as const };

function parseStoredChat(payloadJson: string, chatId: string) {
  const parsed = JSON.parse(payloadJson);
  return parseAiWorkspaceSnapshot({
    chats: [parsed],
    generatedUserMemory: '',
    selectedModel: null,
    enabledTools: {},
    customSystemPrompt: '',
  }, `Stored chat "${chatId}"`).chats[0];
}

export function createAiWorkspaceRepository(
  database: BetterSqlite3.Database = getDatabase(),
  ownerId = getCanonicalOwnerId(),
) {
  const settingsRepository = createAppSettingsRepository(database, ownerId);
  const selectChats = database.prepare('SELECT id, payload_json FROM ai_chats WHERE owner_id = ? ORDER BY updated_at DESC, id DESC');
  const selectChat = database.prepare('SELECT payload_json FROM ai_chats WHERE owner_id = ? AND id = ?');
  const insertChat = database.prepare(`
    INSERT INTO ai_chats (id, owner_id, title, mode, updated_at, payload_json)
    VALUES (@id, @owner_id, @title, @mode, @updated_at, @payload_json)
  `);
  const updateChat = database.prepare(`
    UPDATE ai_chats
    SET title = @title,
        mode = @mode,
        updated_at = @updated_at,
        payload_json = @payload_json
    WHERE owner_id = @owner_id AND id = @id
  `);
  const clearChats = database.prepare('DELETE FROM ai_chats WHERE owner_id = ?');

  function selectStoredChats(): Chat[] {
    const rows = selectChats.all(ownerId) as Array<{ id: string; payload_json: string }>;
    return rows.map((row) => parseStoredChat(row.payload_json, row.id));
  }

  function loadGeneratedUserMemory() {
    return settingsRepository.readJsonSetting(generatedUserMemoryKey, (value, field) => parseAiWorkspaceSnapshot({
      ...createEmptyAiWorkspaceSnapshot(),
      generatedUserMemory: value,
    }, field).generatedUserMemory, '');
  }

  return {
    loadAiWorkspace(): AiWorkspaceSnapshot {
      return {
        chats: selectStoredChats(),
        generatedUserMemory: loadGeneratedUserMemory(),
        selectedProvider: settingsRepository.readJsonSetting(selectedProviderKey, parseAiPreferences, defaultAiPreferences).selectedProvider,
        selectedModel: settingsRepository.readJsonSetting(selectedModelKey, parseAiPreferences, defaultAiPreferences).selectedModel,
        visionMode: settingsRepository.readJsonSetting(visionModeKey, parseAiPreferences, defaultAiPreferences).visionMode,
        enabledTools: settingsRepository.readJsonSetting(
          enabledToolsKey,
          (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), enabledTools: value }, field).enabledTools,
          {},
        ),
        customSystemPrompt: settingsRepository.readJsonSetting(
          customSystemPromptKey,
          (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), customSystemPrompt: value }, field).customSystemPrompt,
          '',
        ),
      };
    },
    loadAiPreferences(): AiPreferences {
      return {
        selectedProvider: settingsRepository.readJsonSetting(selectedProviderKey, parseAiPreferences, defaultAiPreferences).selectedProvider,
        selectedModel: settingsRepository.readJsonSetting(selectedModelKey, parseAiPreferences, defaultAiPreferences).selectedModel,
        visionMode: settingsRepository.readJsonSetting(visionModeKey, parseAiPreferences, defaultAiPreferences).visionMode,
      };
    },
    loadGeneratedUserMemory,
    saveGeneratedUserMemory(value: string) {
      settingsRepository.writeJsonSetting(generatedUserMemoryKey, value);
    },
    findChatById(chatId: string) {
      const row = selectChat.get(ownerId, chatId) as { payload_json: string } | undefined;
      return row ? parseStoredChat(row.payload_json, chatId) : null;
    },
    updateChatSummary(chatId: string, summary: string, summaryUpdatedAt: string | null) {
      const chat = this.findChatById(chatId);
      if (!chat) {
        return null;
      }

      const nextChat = {
        ...chat,
        summary: summary || undefined,
        summaryUpdatedAt: summaryUpdatedAt ?? undefined,
      } satisfies Chat;
      updateChat.run({
        id: nextChat.id,
        owner_id: ownerId,
        title: nextChat.title,
        mode: nextChat.mode,
        updated_at: nextChat.updatedAt,
        payload_json: JSON.stringify(nextChat),
      });
      return nextChat;
    },
    saveAiWorkspace(snapshot: AiWorkspaceSnapshot) {
      const transaction = database.transaction((nextSnapshot: AiWorkspaceSnapshot) => {
        clearChats.run(ownerId);
        for (const chat of nextSnapshot.chats) {
          insertChat.run({
            id: chat.id,
            owner_id: ownerId,
            title: chat.title,
            mode: chat.mode,
            updated_at: chat.updatedAt,
            payload_json: JSON.stringify(chat),
          });
        }

        settingsRepository.writeJsonSetting(selectedProviderKey, { selectedProvider: nextSnapshot.selectedProvider });
        settingsRepository.writeJsonSetting(selectedModelKey, { selectedModel: nextSnapshot.selectedModel });
        settingsRepository.writeJsonSetting(visionModeKey, { visionMode: nextSnapshot.visionMode });
        settingsRepository.writeJsonSetting(enabledToolsKey, nextSnapshot.enabledTools);
        settingsRepository.writeJsonSetting(customSystemPromptKey, nextSnapshot.customSystemPrompt);
        settingsRepository.writeJsonSetting(generatedUserMemoryKey, nextSnapshot.generatedUserMemory);
      });

      transaction(snapshot);
    },
  };
}

let aiWorkspaceRepositorySingleton: ReturnType<typeof createAiWorkspaceRepository> | null = null;

function getAiWorkspaceRepositorySingleton() {
  aiWorkspaceRepositorySingleton ??= createAiWorkspaceRepository();
  return aiWorkspaceRepositorySingleton;
}

export const aiWorkspaceRepository = new Proxy({} as ReturnType<typeof createAiWorkspaceRepository>, {
  get(_target, property, receiver) {
    return Reflect.get(getAiWorkspaceRepositorySingleton(), property, receiver);
  },
});

export const loadAiWorkspace = () => getAiWorkspaceRepositorySingleton().loadAiWorkspace();
export const loadAiPreferences = () => getAiWorkspaceRepositorySingleton().loadAiPreferences();
export const loadGeneratedUserMemory = () => getAiWorkspaceRepositorySingleton().loadGeneratedUserMemory();
export const saveGeneratedUserMemory = (value: string) => getAiWorkspaceRepositorySingleton().saveGeneratedUserMemory(value);
export const findChatById = (chatId: string) => getAiWorkspaceRepositorySingleton().findChatById(chatId);
export const updateChatSummary = (chatId: string, summary: string, summaryUpdatedAt: string | null) =>
  getAiWorkspaceRepositorySingleton().updateChatSummary(chatId, summary, summaryUpdatedAt);
export const saveAiWorkspace = (snapshot: AiWorkspaceSnapshot) => getAiWorkspaceRepositorySingleton().saveAiWorkspace(snapshot);
