import type BetterSqlite3 from 'better-sqlite3';
import { AiPreferences, AiWorkspaceSnapshot, Chat, createEmptyAiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
import { getDatabase } from './database';
import { readJsonSetting, writeJsonSetting } from './app-settings-repository';

const selectedModelKey = 'ai.selected-model';
const selectedProviderKey = 'ai.selected-provider';
const enabledToolsKey = 'ai.enabled-tools';
const customSystemPromptKey = 'ai.custom-system-prompt';
const generatedUserMemoryKey = 'ai.generated-user-memory';

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

export function createAiWorkspaceRepository(database: BetterSqlite3.Database = getDatabase()) {
  const selectChats = database.prepare('SELECT id, payload_json FROM ai_chats ORDER BY updated_at DESC, id DESC');
  const selectChat = database.prepare('SELECT payload_json FROM ai_chats WHERE id = ?');
  const insertChat = database.prepare(`
    INSERT INTO ai_chats (id, title, mode, updated_at, payload_json)
    VALUES (@id, @title, @mode, @updated_at, @payload_json)
  `);
  const updateChat = database.prepare(`
    UPDATE ai_chats
    SET title = @title,
        mode = @mode,
        updated_at = @updated_at,
        payload_json = @payload_json
    WHERE id = @id
  `);
  const clearChats = database.prepare('DELETE FROM ai_chats');

  function selectStoredChats(): Chat[] {
    const rows = selectChats.all() as Array<{ id: string; payload_json: string }>;
    return rows.map((row) => parseStoredChat(row.payload_json, row.id));
  }

  function loadGeneratedUserMemory() {
    return readJsonSetting(database, generatedUserMemoryKey, (value, field) => parseAiWorkspaceSnapshot({
      ...createEmptyAiWorkspaceSnapshot(),
      generatedUserMemory: value,
    }, field).generatedUserMemory, '');
  }

  return {
    loadAiWorkspace(): AiWorkspaceSnapshot {
      return {
        chats: selectStoredChats(),
        generatedUserMemory: loadGeneratedUserMemory(),
        selectedProvider: readJsonSetting(database, selectedProviderKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedProvider,
        selectedModel: readJsonSetting(database, selectedModelKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedModel,
        enabledTools: readJsonSetting(
          database,
          enabledToolsKey,
          (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), enabledTools: value }, field).enabledTools,
          {},
        ),
        customSystemPrompt: readJsonSetting(
          database,
          customSystemPromptKey,
          (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), customSystemPrompt: value }, field).customSystemPrompt,
          '',
        ),
      };
    },
    loadAiPreferences(): AiPreferences {
      return {
        selectedProvider: readJsonSetting(database, selectedProviderKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedProvider,
        selectedModel: readJsonSetting(database, selectedModelKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedModel,
      };
    },
    loadGeneratedUserMemory,
    saveGeneratedUserMemory(value: string) {
      writeJsonSetting(database, generatedUserMemoryKey, value);
    },
    findChatById(chatId: string) {
      const row = selectChat.get(chatId) as { payload_json: string } | undefined;
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
        title: nextChat.title,
        mode: nextChat.mode,
        updated_at: nextChat.updatedAt,
        payload_json: JSON.stringify(nextChat),
      });
      return nextChat;
    },
    saveAiWorkspace(snapshot: AiWorkspaceSnapshot) {
      const transaction = database.transaction((nextSnapshot: AiWorkspaceSnapshot) => {
        clearChats.run();
        for (const chat of nextSnapshot.chats) {
          insertChat.run({
            id: chat.id,
            title: chat.title,
            mode: chat.mode,
            updated_at: chat.updatedAt,
            payload_json: JSON.stringify(chat),
          });
        }

        writeJsonSetting(database, selectedProviderKey, { selectedProvider: nextSnapshot.selectedProvider });
        writeJsonSetting(database, selectedModelKey, { selectedModel: nextSnapshot.selectedModel });
        writeJsonSetting(database, enabledToolsKey, nextSnapshot.enabledTools);
        writeJsonSetting(database, customSystemPromptKey, nextSnapshot.customSystemPrompt);
        writeJsonSetting(database, generatedUserMemoryKey, nextSnapshot.generatedUserMemory);
      });

      transaction(snapshot);
    },
  };
}

export const aiWorkspaceRepository = createAiWorkspaceRepository();

export const loadAiWorkspace = () => aiWorkspaceRepository.loadAiWorkspace();
export const loadAiPreferences = () => aiWorkspaceRepository.loadAiPreferences();
export const loadGeneratedUserMemory = () => aiWorkspaceRepository.loadGeneratedUserMemory();
export const saveGeneratedUserMemory = (value: string) => aiWorkspaceRepository.saveGeneratedUserMemory(value);
export const findChatById = (chatId: string) => aiWorkspaceRepository.findChatById(chatId);
export const updateChatSummary = (chatId: string, summary: string, summaryUpdatedAt: string | null) =>
  aiWorkspaceRepository.updateChatSummary(chatId, summary, summaryUpdatedAt);
export const saveAiWorkspace = (snapshot: AiWorkspaceSnapshot) => aiWorkspaceRepository.saveAiWorkspace(snapshot);
