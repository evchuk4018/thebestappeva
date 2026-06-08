import { appendMessage, createAssistantCancelledMessage, createAssistantErrorMessage } from './helpers';
import { createAssistantLiveUpdater } from './assistant-live-message';
import { isAbortError, throwIfAborted } from './abort-utils';
import { OllamaChatMessage, streamChatWithModel } from './ollama-client';
import { buildTurnCancelledMessage, buildTurnFailureMessage, normalizeTurnError } from './chat-helpers';
import { SystemPromptContext } from './system-prompt';
import { Chat, OllamaAvailability } from './types';
import { MAX_CONSECUTIVE_TOOL_ERRORS, MAX_TOOL_CALLS_PER_TURN, executeToolInvocation } from './tools/executor';
import { buildModelMessages, buildOllamaTools, formatToolResultContent } from './tools/prompting';
import { toPersistedToolResult } from './tools/result-persistence';
import { ToolRegistryEntry } from './tools/types';

export interface ResolvedTurn {
  chat: Chat;
  availability: OllamaAvailability;
  lastError: string | null;
}

interface ResolveThinkingTurnOptions {
  chat: Chat;
  model: string;
  activeToolEntries: ToolRegistryEntry[];
  onProgress: (chat: Chat) => void;
  promptContext: SystemPromptContext;
  resolveToolId: (functionName: string) => string;
  signal?: AbortSignal;
}

export async function resolveThinkingTurn({
  chat,
  model,
  activeToolEntries,
  onProgress,
  promptContext,
  resolveToolId,
  signal,
}: ResolveThinkingTurnOptions): Promise<ResolvedTurn> {
  let workingChat = chat;
  let consecutiveToolErrors = 0;
  let toolCallCount = 0;
  let requestMessages = await buildModelMessages(chat.messages, promptContext);
  const liveAssistant = createAssistantLiveUpdater({
    chat,
    model,
    onProgress: (nextChat) => {
      workingChat = nextChat;
      onProgress(nextChat);
    },
  });

  const cancelTurn = (): ResolvedTurn =>
    liveAssistant.hasAssistantMessage()
      ? (liveAssistant.finalize(buildTurnCancelledMessage(), undefined, 'cancelled'),
        { chat: workingChat, availability: 'ready', lastError: null })
      : {
          chat: appendMessage(workingChat, createAssistantCancelledMessage(buildTurnCancelledMessage(), model)),
          availability: 'ready',
          lastError: null,
        };

  try {
    while (true) {
      throwIfAborted(signal);
      let hasRoundToolCalls = false;
      const reply = await streamThinkingRound(model, requestMessages, buildOllamaTools(activeToolEntries), liveAssistant, signal, {
        onToolCalls() {
          hasRoundToolCalls = true;
        },
      });
      throwIfAborted(signal);

      if (!reply.toolCalls?.length) {
        liveAssistant.finalize(reply.content, reply.model);
        return { chat: workingChat, availability: 'ready', lastError: null };
      }

      if (toolCallCount + reply.toolCalls.length > MAX_TOOL_CALLS_PER_TURN) {
        return finalizeToolLimit(liveAssistant, workingChat, reply.model);
      }

      requestMessages = [
        ...requestMessages,
        { role: 'assistant', content: hasRoundToolCalls ? '' : reply.content, thinking: reply.thinking, tool_calls: reply.toolCalls } satisfies OllamaChatMessage,
      ];

      for (const toolCall of reply.toolCalls) {
        throwIfAborted(signal);
        const invocation = {
          toolId: resolveToolId(toolCall.function.name),
          functionName: toolCall.function.name,
          args: toolCall.function.arguments ?? {},
          createdAt: new Date().toISOString(),
        };

        liveAssistant.appendToolCall(invocation, reply.model);
        const execution = await executeToolInvocation(invocation, activeToolEntries, { model, signal });
        const { transientImages, ...result } = execution;
        throwIfAborted(signal);
        liveAssistant.appendToolResult(toPersistedToolResult(result), reply.model);
        toolCallCount += 1;
        consecutiveToolErrors = result.ok ? 0 : consecutiveToolErrors + 1;
        requestMessages = [
          ...requestMessages,
          { role: 'tool', tool_name: invocation.functionName, content: formatToolResultContent(result), images: transientImages } satisfies OllamaChatMessage,
        ];

        if (consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
          liveAssistant.finalize(
            'I stopped after three consecutive local tool errors. Restart the development server if its API routes changed, then try again.',
            reply.model,
            'error',
          );
          return { chat: workingChat, availability: 'ready', lastError: 'Three consecutive tool errors stopped this turn.' };
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      return cancelTurn();
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
      chat: appendMessage(workingChat, createAssistantErrorMessage(buildTurnFailureMessage(clientError), model)),
      availability: clientError.kind === 'connection' ? 'unavailable' : 'ready',
      lastError: clientError.message,
    };
  }
}

async function streamThinkingRound(
  model: string,
  requestMessages: OllamaChatMessage[],
  availableTools: ReturnType<typeof buildOllamaTools>,
  liveAssistant: ReturnType<typeof createAssistantLiveUpdater>,
  signal: AbortSignal | undefined,
  options: { onToolCalls: () => void },
) {
  let hasRoundToolCalls = false;
  return streamChatWithModel(model, requestMessages, {
    think: true,
    tools: availableTools,
    signal,
    onEvent: (event) => {
      if (event.type === 'thinking') {
        liveAssistant.syncThinking(event.snapshot, event.model);
        return;
      }

      if (event.type === 'tool-calls') {
        hasRoundToolCalls = event.toolCalls.length > 0;
        if (hasRoundToolCalls) {
          options.onToolCalls();
          liveAssistant.syncContent('', event.model);
        }
        return;
      }

      if (event.type === 'content' && !hasRoundToolCalls) {
        liveAssistant.syncContent(event.snapshot, event.model);
      }
    },
  });
}

function finalizeToolLimit(
  liveAssistant: ReturnType<typeof createAssistantLiveUpdater>,
  workingChat: Chat,
  replyModel?: string,
): ResolvedTurn {
  const message = 'I hit the 20-call local tool limit for this turn. Please narrow the request or continue in a follow-up.';
  if (liveAssistant.hasAssistantMessage()) {
    liveAssistant.finalize(message, replyModel, 'error');
    return { chat: workingChat, availability: 'ready', lastError: 'Tool-call limit reached for this turn.' };
  }

  return {
    chat: appendMessage(workingChat, createAssistantErrorMessage(message, replyModel)),
    availability: 'ready',
    lastError: 'Tool-call limit reached for this turn.',
  };
}
