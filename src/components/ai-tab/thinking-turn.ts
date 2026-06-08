import {
  appendMessage,
  createAssistantCancelledMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createThinkingTraceStep,
  createToolCallTraceStep,
  createToolResultTraceStep,
  upsertMessage,
} from './helpers';
import { isAbortError, throwIfAborted } from './abort-utils';
import { chatWithModel, OllamaChatMessage } from './ollama-client';
import { buildTurnCancelledMessage, buildTurnFailureMessage, normalizeTurnError } from './chat-helpers';
import { SystemPromptContext } from './system-prompt';
import { AssistantMessage, Chat, OllamaAvailability } from './types';
import {
  MAX_CONSECUTIVE_TOOL_ERRORS,
  MAX_TOOL_CALLS_PER_TURN,
  executeToolInvocation,
} from './tools/executor';
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
  let requestMessages: OllamaChatMessage[] = [];
  const availableTools = buildOllamaTools(activeToolEntries);
  let assistantMessage: AssistantMessage | null = null;

  const syncAssistantMessage = (nextMessage: AssistantMessage, updatedAt = new Date().toISOString()) => {
    assistantMessage = nextMessage;
    workingChat = upsertMessage(workingChat, nextMessage, updatedAt);
    onProgress(workingChat);
  };

  const ensureAssistantMessage = (replyModel?: string) => {
    if (assistantMessage) {
      return assistantMessage;
    }

    assistantMessage = createAssistantMessage('', replyModel ?? model);
    workingChat = appendMessage(workingChat, assistantMessage);
    onProgress(workingChat);
    return assistantMessage;
  };

  const appendThinking = (thinking: string | undefined, replyModel?: string) => {
    const nextThinking = thinking?.trim();
    if (!nextThinking) {
      return;
    }

    const baseMessage = ensureAssistantMessage(replyModel);
    syncAssistantMessage(
      {
        ...baseMessage,
        model: replyModel ?? baseMessage.model,
        trace: [...(baseMessage.trace ?? []), createThinkingTraceStep(nextThinking)],
      },
      new Date().toISOString(),
    );
  };

  const appendToolCall = (invocation: Parameters<typeof createToolCallTraceStep>[0], replyModel?: string) => {
    const baseMessage = ensureAssistantMessage(replyModel);
    syncAssistantMessage(
      {
        ...baseMessage,
        model: replyModel ?? baseMessage.model,
        trace: [...(baseMessage.trace ?? []), createToolCallTraceStep(invocation)],
      },
      invocation.createdAt,
    );
  };

  const appendToolResult = (result: Parameters<typeof createToolResultTraceStep>[0], replyModel?: string) => {
    const createdAt = new Date().toISOString();
    const baseMessage = ensureAssistantMessage(replyModel);
    syncAssistantMessage(
      {
        ...baseMessage,
        model: replyModel ?? baseMessage.model,
        trace: [...(baseMessage.trace ?? []), createToolResultTraceStep(result, createdAt)],
      },
      createdAt,
    );
  };

  const finalizeAssistant = (content: string, replyModel?: string, status: AssistantMessage['status'] = 'complete') => {
    const baseMessage = ensureAssistantMessage(replyModel);
    syncAssistantMessage(
      {
        ...baseMessage,
        model: replyModel ?? baseMessage.model,
        content: content.trim(),
        status,
      },
      new Date().toISOString(),
    );
  };

  const cancelTurn = (): ResolvedTurn => {
    if (assistantMessage) {
      finalizeAssistant(buildTurnCancelledMessage(), assistantMessage.model ?? model, 'cancelled');
      return {
        chat: workingChat,
        availability: 'ready',
        lastError: null,
      };
    }

    return {
      chat: appendMessage(workingChat, createAssistantCancelledMessage(buildTurnCancelledMessage(), model)),
      availability: 'ready',
      lastError: null,
    };
  };

  try {
    requestMessages = await buildModelMessages(workingChat.messages, promptContext);

    while (true) {
      throwIfAborted(signal);

      let reply;
      try {
        reply = await chatWithModel(model, requestMessages, {
          think: true,
          tools: availableTools,
          signal,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }

        const clientError = normalizeTurnError(error);
        if (assistantMessage) {
          finalizeAssistant(buildTurnFailureMessage(clientError), model, 'error');
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

      appendThinking(reply.thinking, reply.model);
      throwIfAborted(signal);

      if (!reply.toolCalls?.length) {
        finalizeAssistant(reply.content, reply.model);
        return {
          chat: workingChat,
          availability: 'ready',
          lastError: null,
        };
      }

      if (toolCallCount + reply.toolCalls.length > MAX_TOOL_CALLS_PER_TURN) {
        if (assistantMessage) {
          finalizeAssistant('I hit the 20-call local tool limit for this turn. Please narrow the request or continue in a follow-up.', reply.model, 'error');
          return {
            chat: workingChat,
            availability: 'ready',
            lastError: 'Tool-call limit reached for this turn.',
          };
        }

        return {
          chat: appendMessage(
            workingChat,
            createAssistantErrorMessage('I hit the 20-call local tool limit for this turn. Please narrow the request or continue in a follow-up.', reply.model),
          ),
          availability: 'ready',
          lastError: 'Tool-call limit reached for this turn.',
        };
      }

      requestMessages = [
        ...requestMessages,
        {
          role: 'assistant',
          content: reply.content,
          thinking: reply.thinking,
          tool_calls: reply.toolCalls,
        } satisfies OllamaChatMessage,
      ];

      for (const toolCall of reply.toolCalls) {
        throwIfAborted(signal);

        const invocation = {
          toolId: resolveToolId(toolCall.function.name),
          functionName: toolCall.function.name,
          args: toolCall.function.arguments ?? {},
          createdAt: new Date().toISOString(),
        };

        appendToolCall(invocation, reply.model);

        const execution = await executeToolInvocation(invocation, activeToolEntries, { model, signal });
        const { transientImages, ...result } = execution;
        throwIfAborted(signal);
        appendToolResult(toPersistedToolResult(result), reply.model);
        toolCallCount += 1;
        consecutiveToolErrors = result.ok ? 0 : consecutiveToolErrors + 1;

        requestMessages = [
          ...requestMessages,
          {
            role: 'tool',
            tool_name: invocation.functionName,
            content: formatToolResultContent(result),
            images: transientImages,
          } satisfies OllamaChatMessage,
        ];

        if (consecutiveToolErrors >= MAX_CONSECUTIVE_TOOL_ERRORS) {
          finalizeAssistant(
            'I stopped after three consecutive local tool errors. Restart the development server if its API routes changed, then try again.',
            reply.model,
            'error',
          );
          return {
            chat: workingChat,
            availability: 'ready',
            lastError: 'Three consecutive tool errors stopped this turn.',
          };
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) {
      return cancelTurn();
    }

    throw error;
  }
}
