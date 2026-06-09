import { OllamaClientError } from './ollama-client';
import { Chat, ChatMode } from './types';

export function replaceChat(currentChats: Chat[], nextChat: Chat) {
  const hasChat = currentChats.some((chat) => chat.id === nextChat.id);
  if (!hasChat) {
    return [nextChat, ...currentChats];
  }

  return currentChats.map((chat) => (chat.id === nextChat.id ? nextChat : chat));
}

export function updateChatMode(currentChats: Chat[], chatId: string, mode: ChatMode) {
  return currentChats.map((chat) => (chat.id === chatId ? { ...chat, mode } : chat));
}

export function updateChatArtifacts(
  currentChats: Chat[],
  chatId: string,
  updater: (chat: Chat) => Chat,
) {
  return currentChats.map((chat) => (chat.id === chatId ? updater(chat) : chat));
}

export function buildTurnFailureMessage(error: OllamaClientError) {
  if (error.kind === 'connection') {
    return 'I could not reach the local Ollama runtime for this turn. Check that Ollama is still running, then try again.';
  }

  return `I hit a local runtime error before I could finish this reply.\n\n${error.message}`;
}

export function buildTurnCancelledMessage() {
  return 'This reply was stopped before it finished.';
}

export function normalizeTurnError(error: unknown) {
  if (error instanceof OllamaClientError) {
    return error;
  }

  if (error instanceof Error) {
    return new OllamaClientError(error.message, 'response');
  }

  return new OllamaClientError('Unable to complete this reply.', 'response');
}
