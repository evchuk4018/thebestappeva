import { appendMessage, createAssistantCancelledMessage, createAssistantErrorMessage } from './helpers';
import { createAssistantLiveUpdater } from './assistant-live-message';
import { isAbortError } from './abort-utils';
import { streamChatWithModel } from './ollama-client';
import { buildTurnCancelledMessage, buildTurnFailureMessage, normalizeTurnError } from './chat-helpers';
import { SystemPromptContext } from './system-prompt';
import { Chat } from './types';
import { buildPlainModelMessages } from './tools/prompting';
import { ResolvedTurn } from './thinking-turn';

interface SendFlashTurnOptions {
  chat: Chat;
  model: string;
  onProgress: (chat: Chat, assistantMessageId: string | null) => void;
  promptContext: SystemPromptContext;
  signal?: AbortSignal;
}

export async function sendFlashTurn({ chat, model, onProgress, promptContext, signal }: SendFlashTurnOptions): Promise<ResolvedTurn> {
  let workingChat = chat;
  const liveAssistant = createAssistantLiveUpdater({
    chat,
    model,
    onProgress: (nextChat, assistantMessageId) => {
      workingChat = nextChat;
      onProgress(nextChat, assistantMessageId);
    },
  });

  try {
    const reply = await streamChatWithModel(model, await buildPlainModelMessages(chat.messages, promptContext), {
      think: false,
      signal,
      onEvent: (event) => {
        if (event.type === 'content') {
          liveAssistant.syncContent(event.snapshot, event.model);
        }
      },
    });

    liveAssistant.finalize(reply.content, reply.model);
    return { chat: workingChat, availability: 'ready', lastError: null };
  } catch (error) {
    if (isAbortError(error)) {
      return liveAssistant.hasAssistantMessage()
        ? (liveAssistant.finalize(buildTurnCancelledMessage(), undefined, 'cancelled'),
          { chat: workingChat, availability: 'ready', lastError: null })
        : {
            chat: appendMessage(chat, createAssistantCancelledMessage(buildTurnCancelledMessage(), model)),
            availability: 'ready',
            lastError: null,
          };
    }

    const clientError = normalizeTurnError(error);
    if (liveAssistant.hasAssistantMessage()) {
      liveAssistant.finalize(buildTurnFailureMessage(clientError), model, 'error');
      return {
        chat: workingChat,
        availability: clientError.kind === 'connection' ? 'unavailable' : 'ready',
        lastError: clientError.message,
      };
    }

    return {
      chat: appendMessage(chat, createAssistantErrorMessage(buildTurnFailureMessage(clientError), model)),
      availability: clientError.kind === 'connection' ? 'unavailable' : 'ready',
      lastError: clientError.message,
    };
  }
}
