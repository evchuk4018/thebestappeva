import {
  appendMessage,
  createAssistantErrorMessage,
  createAssistantMessage,
  createThinkingTraceStep,
  createToolCallTraceStep,
  createToolResultTraceStep,
  upsertMessage,
} from './helpers';
import { chatWithModel, OllamaChatMessage } from './ollama-client';
import { buildTurnFailureMessage, normalizeTurnError } from './chat-helpers';
import { AssistantMessage, Chat, OllamaAvailability } from './types';
import { MAX_TOOL_CALL_DEPTH, executeToolInvocation } from './tools/executor';
import { buildModelMessages, buildOllamaTools, formatToolResultContent } from './tools/prompting';
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
  resolveToolId: (functionName: string) => string;
}

export async function resolveThinkingTurn({
  chat,
  model,
  activeToolEntries,
  onProgress,
  resolveToolId,
}: ResolveThinkingTurnOptions): Promise<ResolvedTurn> {
  let workingChat = chat;
  let toolCallCount = 0;
  let requestMessages = buildModelMessages(workingChat.messages);
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

  while (true) {
    let reply;
    try {
      reply = await chatWithModel(model, requestMessages, {
        think: true,
        tools: availableTools,
      });
    } catch (error) {
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

    if (!reply.toolCalls?.length) {
      finalizeAssistant(reply.content, reply.model);
      return {
        chat: workingChat,
        availability: 'ready',
        lastError: null,
      };
    }

    if (toolCallCount + reply.toolCalls.length > MAX_TOOL_CALL_DEPTH) {
      if (assistantMessage) {
        finalizeAssistant('I hit the local tool-call limit for this turn. Please narrow the request or ask a follow-up.', reply.model, 'error');
        return {
          chat: workingChat,
          availability: 'ready',
          lastError: 'Tool-call limit reached for this turn.',
        };
      }

      return {
        chat: appendMessage(
          workingChat,
          createAssistantErrorMessage('I hit the local tool-call limit for this turn. Please narrow the request or ask a follow-up.', reply.model),
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
      const invocation = {
        toolId: resolveToolId(toolCall.function.name),
        functionName: toolCall.function.name,
        args: toolCall.function.arguments ?? {},
        createdAt: new Date().toISOString(),
      };

      appendToolCall(invocation, reply.model);

      const result = await executeToolInvocation(invocation, activeToolEntries);
      appendToolResult(result, reply.model);

      requestMessages = [
        ...requestMessages,
        {
          role: 'tool',
          tool_name: invocation.functionName,
          content: formatToolResultContent(result),
        } satisfies OllamaChatMessage,
      ];
    }

    toolCallCount += reply.toolCalls.length;
  }
}
