import {
  AiMessage,
  AiAttachmentReference,
  AssistantAskUserTraceStep,
  AssistantMessage,
  AssistantMessageStatus,
  ArtifactCardSummary,
  AssistantTraceStep,
  Chat,
  ChatMode,
  OllamaModel,
  PullProgress,
  UserMessage,
} from './types';
import { suggestionPrompts } from './data';
import { ToolInvocation, ToolResult } from './tools/types';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createUserMessage(content: string, attachments?: AiAttachmentReference[]): UserMessage {
  return {
    id: createId('msg'),
    kind: 'user',
    content: content.trim(),
    attachments: attachments?.length ? attachments : undefined,
    createdAt: new Date().toISOString(),
  };
}

export function createAssistantMessage(
  content: string,
  model?: string,
  options: {
    artifactCards?: ArtifactCardSummary[];
    status?: AssistantMessageStatus;
    trace?: AssistantTraceStep[];
  } = {},
): AssistantMessage {
  return {
    id: createId('msg'),
    kind: 'assistant',
    content: content.trim(),
    model,
    artifactCards: options.artifactCards?.length ? options.artifactCards : undefined,
    trace: options.trace?.length ? options.trace : undefined,
    status: options.status ?? 'complete',
    createdAt: new Date().toISOString(),
  };
}

export function createAssistantErrorMessage(
  content: string,
  model?: string,
  options: {
    trace?: AssistantTraceStep[];
  } = {},
): AssistantMessage {
  return createAssistantMessage(content, model, { status: 'error', trace: options.trace });
}

export function createAssistantCancelledMessage(
  content: string,
  model?: string,
  options: {
    trace?: AssistantTraceStep[];
  } = {},
): AssistantMessage {
  return createAssistantMessage(content, model, { status: 'cancelled', trace: options.trace });
}

export function createThinkingTraceStep(content: string, createdAt = new Date().toISOString()): AssistantTraceStep {
  return {
    id: createId('trace'),
    kind: 'thinking',
    content: content.trim(),
    createdAt,
  };
}

export function createToolCallTraceStep(invocation: ToolInvocation): AssistantTraceStep {
  return {
    id: createId('trace'),
    kind: 'tool-call',
    createdAt: invocation.createdAt,
    invocation,
  };
}

export function createToolResultTraceStep(result: ToolResult, createdAt = new Date().toISOString()): AssistantTraceStep {
  return {
    id: createId('trace'),
    kind: 'tool-result',
    createdAt,
    result,
  };
}

export function createAskUserTraceStep(
  step: Omit<AssistantAskUserTraceStep, 'id' | 'kind'>,
): AssistantTraceStep {
  return {
    ...step,
    id: createId('trace'),
    kind: 'ask-user',
  };
}

export function createChatTitle(message: string) {
  const summary = message.trim().split(/\s+/).slice(0, 5).join(' ');
  return summary.length > 42 ? `${summary.slice(0, 42)}...` : summary || 'New local chat';
}

export function createNewChat(message: UserMessage, mode: ChatMode): Chat {
  return {
    id: `chat-${Date.now()}`,
    title: createChatTitle(message.content),
    messages: [message],
    activeArtifactId: null,
    includedArtifactIds: [],
    mode,
    updatedAt: message.createdAt,
  };
}

export function appendMessage(chat: Chat, message: AiMessage): Chat {
  return {
    ...chat,
    messages: [...chat.messages, message],
    updatedAt: message.createdAt,
  };
}

export function upsertMessage(chat: Chat, message: AiMessage, updatedAt = new Date().toISOString()): Chat {
  const nextMessages = chat.messages.some((current) => current.id === message.id)
    ? chat.messages.map((current) => (current.id === message.id ? message : current))
    : [...chat.messages, message];

  return {
    ...chat,
    messages: nextMessages,
    updatedAt,
  };
}

export function getSuggestionPrompt(label: string) {
  return suggestionPrompts[label] ?? '';
}

export function sortModels(models: OllamaModel[]) {
  return [...models].sort((left, right) => Date.parse(right.modifiedAt ?? '') - Date.parse(left.modifiedAt ?? ''));
}

export function formatBytes(bytes?: number) {
  if (!bytes) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatModelMeta(model: OllamaModel) {
  const parts = [model.parameterSize, model.family, model.quantizationLevel].filter(Boolean);
  return parts.join(' • ');
}

export function normalizeModelName(name: string) {
  return name.trim();
}

export function formatProgress(progress: PullProgress | null) {
  if (!progress) {
    return null;
  }

  const bytesText = progress.total
    ? `${formatBytes(progress.completed) ?? '0 B'} / ${formatBytes(progress.total) ?? '0 B'}`
    : formatBytes(progress.completed);

  if (progress.total && progress.completed) {
    const percent = Math.min(100, Math.round((progress.completed / progress.total) * 100));
    return `${progress.status} (${percent}%)${bytesText ? ` • ${bytesText}` : ''}`;
  }

  return bytesText ? `${progress.status} • ${bytesText}` : progress.status;
}
