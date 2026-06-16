import { parseAiMemoryRefreshResponse } from '../../shared/ai-memory-contract';

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({ ok: false, error: 'The local server returned invalid JSON.' }));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `The local server failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

export async function refreshAiChatMemory(chatId: string, options: { signal?: AbortSignal } = {}) {
  const response = await fetch(`/api/ai/chats/${encodeURIComponent(chatId)}/memory-refresh`, {
    method: 'POST',
    signal: options.signal,
  });
  return parseAiMemoryRefreshResponse(await readJsonResponse(response));
}
