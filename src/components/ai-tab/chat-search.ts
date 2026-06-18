import type { Chat } from './types';

const SEARCH_RESULT_LIMIT = 50;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildSearchableText(chat: Chat) {
  const messageText = chat.messages
    .map((message) => message.content ?? '')
    .filter(Boolean)
    .join(' ');
  return normalizeText(`${chat.title} ${messageText}`);
}

export function searchChats(chats: Chat[], query: string): Chat[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return chats;
  }

  return chats
    .filter((chat) => buildSearchableText(chat).includes(normalizedQuery))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, SEARCH_RESULT_LIMIT);
}