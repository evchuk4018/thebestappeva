import { AiPreferences, AiWorkspaceSnapshot, Chat, createEmptyAiWorkspaceSnapshot, parseAiPreferences, parseAiWorkspaceSnapshot } from '../../shared/ai-workspace-contract';
import { getDatabase } from './database';
import { readJsonSetting, writeJsonSetting } from './app-settings-repository';

const selectedModelKey = 'ai.selected-model';
const selectedProviderKey = 'ai.selected-provider';
const enabledToolsKey = 'ai.enabled-tools';
const customSystemPromptKey = 'ai.custom-system-prompt';

function parseStoredChat(payloadJson: string, chatId: string) {
  const parsed = JSON.parse(payloadJson);
  return parseAiWorkspaceSnapshot({
    chats: [parsed],
    selectedModel: null,
    enabledTools: {},
    customSystemPrompt: '',
  }, `Stored chat "${chatId}"`).chats[0];
}

function selectStoredChats(): Chat[] {
  const rows = getDatabase()
    .prepare('SELECT id, payload_json FROM ai_chats ORDER BY updated_at DESC, id DESC')
    .all() as Array<{ id: string; payload_json: string }>;

  return rows.map((row) => parseStoredChat(row.payload_json, row.id));
}

export function loadAiWorkspace(): AiWorkspaceSnapshot {
  return {
    chats: selectStoredChats(),
    selectedProvider: readJsonSetting(selectedProviderKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedProvider,
    selectedModel: readJsonSetting(selectedModelKey, parseAiPreferences, { selectedModel: null }).selectedModel,
    enabledTools: readJsonSetting(
      enabledToolsKey,
      (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), enabledTools: value }, field).enabledTools,
      {},
    ),
    customSystemPrompt: readJsonSetting(
      customSystemPromptKey,
      (value, field) => parseAiWorkspaceSnapshot({ ...createEmptyAiWorkspaceSnapshot(), customSystemPrompt: value }, field).customSystemPrompt,
      '',
    ),
  };
}

export function loadAiPreferences(): AiPreferences {
  return {
    selectedProvider: readJsonSetting(selectedProviderKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedProvider,
    selectedModel: readJsonSetting(selectedModelKey, parseAiPreferences, { selectedProvider: 'ollama', selectedModel: null }).selectedModel,
  };
}

export function saveAiWorkspace(snapshot: AiWorkspaceSnapshot) {
  const database = getDatabase();
  const insertChat = database.prepare(`
    INSERT INTO ai_chats (id, title, mode, updated_at, payload_json)
    VALUES (@id, @title, @mode, @updated_at, @payload_json)
  `);
  const clearChats = database.prepare('DELETE FROM ai_chats');
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

    writeJsonSetting(selectedProviderKey, { selectedProvider: nextSnapshot.selectedProvider });
    writeJsonSetting(selectedModelKey, { selectedModel: nextSnapshot.selectedModel });
    writeJsonSetting(enabledToolsKey, nextSnapshot.enabledTools);
    writeJsonSetting(customSystemPromptKey, nextSnapshot.customSystemPrompt);
  });

  transaction(snapshot);
}
