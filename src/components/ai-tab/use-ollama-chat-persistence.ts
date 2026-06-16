import { refreshAiChatMemory } from '../../lib/ai-memory-storage';
import { flushWorkspaceSnapshot, syncMemoryRefreshIntoWorkspace, type WorkspaceMemorySyncContext } from './workspace-memory-sync';

interface QueuedMemoryRefreshOptions extends WorkspaceMemorySyncContext {
  chatId: string;
  signal?: AbortSignal;
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export async function refreshQueuedChatMemory(options: QueuedMemoryRefreshOptions) {
  await flushWorkspaceSnapshot(options);
  const refreshed = await refreshAiChatMemory(options.chatId, { signal: options.signal });
  return syncMemoryRefreshIntoWorkspace(options, refreshed);
}
