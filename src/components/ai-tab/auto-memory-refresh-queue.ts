interface AutoMemoryRefreshQueueOptions {
  execute: (chatId: string, signal: AbortSignal) => Promise<void>;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export function createAutoMemoryRefreshQueue({ execute }: AutoMemoryRefreshQueueOptions) {
  let disposed = false;
  let pausedForImageTurn = false;
  let pendingChatIds: string[] = [];
  let inFlight: { chatId: string; controller: AbortController } | null = null;

  const requeue = (chatId: string, toFront = false) => {
    pendingChatIds = pendingChatIds.filter((pendingChatId) => pendingChatId !== chatId);
    if (toFront) {
      pendingChatIds = [chatId, ...pendingChatIds];
      return;
    }
    pendingChatIds = [...pendingChatIds, chatId];
  };

  const drain = () => {
    if (disposed || pausedForImageTurn || inFlight || pendingChatIds.length === 0) {
      return;
    }

    const chatId = pendingChatIds[0]!;
    pendingChatIds = pendingChatIds.slice(1);
    const controller = new AbortController();
    inFlight = { chatId, controller };

    void execute(chatId, controller.signal)
      .catch((error) => {
        if (!isAbortError(error)) {
          return;
        }
      })
      .finally(() => {
        if (inFlight?.chatId === chatId) {
          inFlight = null;
        }
        drain();
      });
  };

  return {
    dispose() {
      disposed = true;
      pendingChatIds = [];
      inFlight?.controller.abort(new DOMException('Disposed background refresh queue.', 'AbortError'));
      inFlight = null;
    },
    enqueue(chatId: string) {
      if (!chatId.trim()) {
        return;
      }
      requeue(chatId);
      drain();
    },
    startForegroundTurn(hasImageAttachments: boolean) {
      if (!hasImageAttachments) {
        return;
      }

      pausedForImageTurn = true;
      if (!inFlight) {
        return;
      }

      requeue(inFlight.chatId, true);
      inFlight.controller.abort(new DOMException('Paused for an image-bearing foreground turn.', 'AbortError'));
    },
    finishForegroundTurn(hasImageAttachments: boolean) {
      if (!hasImageAttachments) {
        return;
      }

      pausedForImageTurn = false;
      drain();
    },
  };
}
