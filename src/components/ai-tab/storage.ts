import { Chat } from './types';

const chatsStorageKey = 'ai-tab.local-chats';
const modelStorageKey = 'ai-tab.selected-model';

export function loadStoredChats() {
  try {
    const stored = window.localStorage.getItem(chatsStorageKey);
    if (!stored) {
      return [] as Chat[];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Chat[]) : [];
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
