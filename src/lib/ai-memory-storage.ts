import { parseAiMemoryRefreshResponse } from '../../shared/ai-memory-contract';
import { requestJson } from './api';

export async function refreshAiChatMemory(chatId: string, options: { signal?: AbortSignal } = {}) {
  return parseAiMemoryRefreshResponse(await requestJson(`/ai/chats/${encodeURIComponent(chatId)}/memory-refresh`, {
    method: 'POST',
    signal: options.signal,
  }));
}
