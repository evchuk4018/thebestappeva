import {
  createAssistantMessage,
  createThinkingTraceStep,
  createToolCallTraceStep,
  createToolResultTraceStep,
  upsertMessage,
} from './helpers';
import { mergeArtifactCardsFromToolResult } from './artifact-cards';
import { AssistantMessage, Chat } from './types';

interface CreateAssistantLiveUpdaterOptions {
  chat: Chat;
  model: string;
  onProgress: (chat: Chat, assistantMessageId: string | null) => void;
}

export function createAssistantLiveUpdater({ chat, model, onProgress }: CreateAssistantLiveUpdaterOptions) {
  let workingChat = chat;
  let assistantMessage: AssistantMessage | null = null;
  let activeThinkingStepId: string | null = null;

  const syncAssistantMessage = (nextMessage: AssistantMessage, updatedAt = new Date().toISOString()) => {
    assistantMessage = nextMessage;
    workingChat = upsertMessage(workingChat, nextMessage, updatedAt);
    onProgress(workingChat, nextMessage.id);
  };

  const ensureAssistantMessage = (replyModel?: string) => {
    if (assistantMessage) {
      return assistantMessage;
    }

    assistantMessage = createAssistantMessage('', replyModel ?? model);
    workingChat = upsertMessage(workingChat, assistantMessage, assistantMessage.createdAt);
    onProgress(workingChat, assistantMessage.id);
    return assistantMessage;
  };

  return {
    appendToolCall(invocation: Parameters<typeof createToolCallTraceStep>[0], replyModel?: string) {
      activeThinkingStepId = null;
      const baseMessage = ensureAssistantMessage(replyModel);
      syncAssistantMessage(
        {
          ...baseMessage,
          model: replyModel ?? baseMessage.model,
          trace: [...(baseMessage.trace ?? []), createToolCallTraceStep(invocation)],
        },
        invocation.createdAt,
      );
    },
    appendToolResult(result: Parameters<typeof createToolResultTraceStep>[0], replyModel?: string) {
      activeThinkingStepId = null;
      const createdAt = new Date().toISOString();
      const baseMessage = ensureAssistantMessage(replyModel);
      syncAssistantMessage(
        {
          ...baseMessage,
          artifactCards: mergeArtifactCardsFromToolResult(baseMessage.artifactCards, result),
          model: replyModel ?? baseMessage.model,
          trace: [...(baseMessage.trace ?? []), createToolResultTraceStep(result, createdAt)],
        },
        createdAt,
      );
    },
    finalize(content: string, replyModel?: string, status: AssistantMessage['status'] = 'complete') {
      activeThinkingStepId = null;
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
    },
    getChat() {
      return workingChat;
    },
    hasAssistantMessage() {
      return Boolean(assistantMessage);
    },
    syncContent(content: string, replyModel?: string, status: AssistantMessage['status'] = 'complete') {
      const baseMessage = ensureAssistantMessage(replyModel);
      syncAssistantMessage(
        {
          ...baseMessage,
          model: replyModel ?? baseMessage.model,
          content,
          status,
        },
        new Date().toISOString(),
      );
    },
    syncThinking(thinking: string, replyModel?: string) {
      if (!thinking.trim()) {
        return;
      }

      const baseMessage = ensureAssistantMessage(replyModel);
      const nextTrace = [...(baseMessage.trace ?? [])];
      const activeIndex = activeThinkingStepId ? nextTrace.findIndex((step) => step.id === activeThinkingStepId) : -1;
      if (activeIndex >= 0 && nextTrace[activeIndex]?.kind === 'thinking') {
        nextTrace[activeIndex] = { ...nextTrace[activeIndex], content: thinking };
      } else {
        const nextStep = createThinkingTraceStep(thinking);
        activeThinkingStepId = nextStep.id;
        nextTrace.push(nextStep);
      }

      syncAssistantMessage(
        {
          ...baseMessage,
          model: replyModel ?? baseMessage.model,
          trace: nextTrace,
        },
        new Date().toISOString(),
      );
    },
  };
}
