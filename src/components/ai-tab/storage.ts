import { AiMessage, Chat } from './types';

const chatsStorageKey = 'ai-tab.local-chats';
const modelStorageKey = 'ai-tab.selected-model';
const enabledToolsStorageKey = 'ai-tab.enabled-tools';

type LegacyMessage = {
  role?: string;
  content?: string;
  createdAt?: string;
  model?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function migrateMessage(message: unknown): AiMessage | null {
  if (!isRecord(message)) {
    return null;
  }

  const kind = typeof message.kind === 'string' ? message.kind : '';
  if (kind === 'user' || kind === 'assistant' || kind === 'tool-call' || kind === 'tool-result') {
    return message as unknown as AiMessage;
  }

  const legacy = message as LegacyMessage;
  if ((legacy.role === 'user' || legacy.role === 'assistant') && typeof legacy.content === 'string') {
    return {
      id: `migrated-${legacy.createdAt ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: legacy.role,
      content: legacy.content,
      model: legacy.model,
      createdAt: legacy.createdAt ?? new Date().toISOString(),
    } as AiMessage;
  }

  return null;
}

function migrateChat(chat: unknown): Chat | null {
  if (!isRecord(chat) || typeof chat.id !== 'string' || typeof chat.title !== 'string' || !Array.isArray(chat.messages)) {
    return null;
  }

  const messages = chat.messages.map(migrateMessage).filter(Boolean) as AiMessage[];
  return {
    id: chat.id,
    title: chat.title,
    messages,
    updatedAt: typeof chat.updatedAt === 'string' ? chat.updatedAt : messages.at(-1)?.createdAt ?? new Date().toISOString(),
  };
}

export function loadStoredChats() {
  try {
    const stored = window.localStorage.getItem(chatsStorageKey);
    if (!stored) {
      return [] as Chat[];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [] as Chat[];
    }

    return parsed.map(migrateChat).filter(Boolean) as Chat[];
  } catch {
    return [] as Chat[];
  }
}

export function saveStoredChats(chats: Chat[]) {
  window.localStorage.setItem(chatsStorageKey, JSON.stringify(chats));
}

export function loadStoredSelectedModel() {
  return window.localStorage.getItem(modelStorageKey);
}

export function saveStoredSelectedModel(model: string | null) {
  if (!model) {
    window.localStorage.removeItem(modelStorageKey);
    return;
  }

  window.localStorage.setItem(modelStorageKey, model);
}

export function loadStoredEnabledTools() {
  try {
    const stored = window.localStorage.getItem(enabledToolsStorageKey);
    if (!stored) {
      return {} as Record<string, boolean>;
    }

    const parsed = JSON.parse(stored);
    return isRecord(parsed) ? (parsed as Record<string, boolean>) : ({} as Record<string, boolean>);
  } catch {
    return {} as Record<string, boolean>;
  }
}

export function saveStoredEnabledTools(enabledTools: Record<string, boolean>) {
  window.localStorage.setItem(enabledToolsStorageKey, JSON.stringify(enabledTools));
}
