import { useEffect, useRef } from 'react';
import { createAutoMemoryRefreshQueue } from './auto-memory-refresh-queue';
import { shouldRefreshMemoryAfterTurn } from './memory-refresh';
import type { ResolvedTurn } from './thinking-turn';
import { isAbortError, refreshQueuedChatMemory } from './use-ollama-chat-persistence';
import type { WorkspaceMemorySyncContext } from './workspace-memory-sync';

export function useAutoMemoryRefresh(context: WorkspaceMemorySyncContext) {
  const queueRef = useRef<ReturnType<typeof createAutoMemoryRefreshQueue> | null>(null);

  if (!queueRef.current) {
    queueRef.current = createAutoMemoryRefreshQueue({
      execute: async (chatId, signal) => {
        try {
          await refreshQueuedChatMemory({
            ...context,
            chatId,
            signal,
          });
        } catch (error) {
          if (isAbortError(error)) {
            throw error;
          }
        }
      },
    });
  }

  const queue = queueRef.current!;

  useEffect(() => () => queue.dispose(), [queue]);

  return {
    finishForegroundTurn(hasImageAttachments: boolean) {
      queue.finishForegroundTurn(hasImageAttachments);
    },
    queueCompletedTurnRefresh(resolvedTurn: ResolvedTurn | null) {
      if (resolvedTurn && shouldRefreshMemoryAfterTurn(resolvedTurn)) {
        queue.enqueue(resolvedTurn.chat.id);
      }
    },
    startForegroundTurn(hasImageAttachments: boolean) {
      queue.startForegroundTurn(hasImageAttachments);
    },
  };
}
