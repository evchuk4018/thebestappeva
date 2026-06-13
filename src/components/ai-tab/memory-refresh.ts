import type { AiMemoryRefreshResponse } from '../../../shared/ai-memory-contract';
import type { Chat } from './types';
import type { ResolvedTurn } from './thinking-turn';

function getLatestAssistantStatus(chat: Chat) {
  return [...chat.messages].reverse().find((message) => message.kind === 'assistant')?.status ?? null;
}

export function shouldRefreshMemoryAfterTurn(turn: ResolvedTurn) {
  return turn.status === 'completed' && getLatestAssistantStatus(turn.chat) === 'complete';
}

export function mergeMemoryRefreshIntoChats(chats: Chat[], payload: AiMemoryRefreshResponse) {
  return chats.map((chat) => (
    chat.id === payload.chatId
      ? {
          ...chat,
          summary: payload.summary || undefined,
          summaryUpdatedAt: payload.summaryUpdatedAt ?? undefined,
        }
      : chat
  ));
}
