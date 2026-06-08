import { Chat } from './types';

export interface LiveChatState {
  chatId: string;
  chat: Chat;
  assistantMessageId: string | null;
}

export function resolveActiveChat(persistedChat: Chat | null, liveChat: LiveChatState | null) {
  if (!persistedChat) {
    return null;
  }

  return liveChat?.chatId === persistedChat.id ? liveChat.chat : persistedChat;
}

export function shouldShowTypingIndicator(isTyping: boolean, liveChat: LiveChatState | null) {
  return isTyping && !liveChat?.assistantMessageId;
}
