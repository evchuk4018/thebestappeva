import { AiMessage, AssistantTraceStep, Chat, ChatMode, UserMessageVersion } from './types';
import { ToolInvocation, ToolResult } from './tools/types';

const chatsStorageKey = 'ai-tab.local-chats.v2';
const modelStorageKey = 'ai-tab.selected-model';
const enabledToolsStorageKey = 'ai-tab.enabled-tools';
const customSystemPromptStorageKey = 'ai-tab.custom-system-prompt.v1';

type LegacyMessage = {
  role?: string;
  content?: string;
  createdAt?: string;
  model?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function migrateAssistantStatus(status: unknown) {
  if (status === 'error' || status === 'cancelled') {
    return status;
  }

  return 'complete';
}

function migrateToolInvocation(invocation: unknown): ToolInvocation | null {
  if (
    !isRecord(invocation) ||
    typeof invocation.toolId !== 'string' ||
    typeof invocation.functionName !== 'string' ||
    !isRecord(invocation.args) ||
    typeof invocation.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    toolId: invocation.toolId,
    functionName: invocation.functionName,
    args: invocation.args,
    createdAt: invocation.createdAt,
  };
}

function migrateToolResult(result: unknown): ToolResult | null {
  if (
    !isRecord(result) ||
    typeof result.toolId !== 'string' ||
    typeof result.functionName !== 'string' ||
    typeof result.ok !== 'boolean' ||
    typeof result.summary !== 'string'
  ) {
    return null;
  }

  return {
    toolId: result.toolId,
    functionName: result.functionName,
    ok: result.ok,
    summary: result.summary,
    data: isRecord(result.data) ? result.data : undefined,
    error: typeof result.error === 'string' ? result.error : undefined,
  };
}

function migrateTraceStep(step: unknown): AssistantTraceStep | null {
  if (!isRecord(step) || typeof step.kind !== 'string' || typeof step.id !== 'string' || typeof step.createdAt !== 'string') {
    return null;
  }

  if (step.kind === 'thinking' && typeof step.content === 'string') {
    return {
      id: step.id,
      kind: 'thinking',
      content: step.content,
      createdAt: step.createdAt,
    };
  }

  if (step.kind === 'tool-call') {
    const invocation = migrateToolInvocation(step.invocation);
    if (!invocation) {
      return null;
    }

    return {
      id: step.id,
      kind: 'tool-call',
      invocation,
      createdAt: step.createdAt,
    };
  }

  if (step.kind === 'tool-result') {
    const result = migrateToolResult(step.result);
    if (!result) {
      return null;
    }

    return {
      id: step.id,
      kind: 'tool-result',
      result,
      createdAt: step.createdAt,
    };
  }

  return null;
}

function migrateUserMessageVersion(version: unknown): UserMessageVersion | null {
  if (
    !isRecord(version) ||
    typeof version.id !== 'string' ||
    typeof version.content !== 'string' ||
    typeof version.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: version.id,
    content: version.content,
    createdAt: version.createdAt,
    messagesAfter: Array.isArray(version.messagesAfter)
      ? (version.messagesAfter.map(migrateMessage).filter(Boolean) as AiMessage[])
      : [],
  };
}

function migrateMessage(message: unknown): AiMessage | null {
  if (!isRecord(message)) {
    return null;
  }

  const kind = typeof message.kind === 'string' ? message.kind : '';
  if (kind === 'assistant') {
    return {
      id: typeof message.id === 'string' ? message.id : `migrated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: 'assistant',
      content: typeof message.content === 'string' ? message.content : '',
      createdAt: typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString(),
      model: typeof message.model === 'string' ? message.model : undefined,
      trace: Array.isArray(message.trace) ? message.trace.map(migrateTraceStep).filter(Boolean) as AssistantTraceStep[] : undefined,
      status: migrateAssistantStatus(message.status),
    } as AiMessage;
  }

  if (kind === 'user' && typeof message.id === 'string' && typeof message.content === 'string' && typeof message.createdAt === 'string') {
    const versions = Array.isArray(message.versions) ? message.versions.map(migrateUserMessageVersion).filter(Boolean) as UserMessageVersion[] : [];
    return {
      id: message.id,
      kind: 'user',
      content: message.content,
      createdAt: message.createdAt,
      activeVersionId: typeof message.activeVersionId === 'string' ? message.activeVersionId : undefined,
      versions: versions.length ? versions : undefined,
    };
  }

  const legacy = message as LegacyMessage;
  if ((legacy.role === 'user' || legacy.role === 'assistant') && typeof legacy.content === 'string') {
    return {
      id: `migrated-${legacy.createdAt ?? Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: legacy.role,
      content: legacy.content,
      model: legacy.model,
      status: 'complete',
      createdAt: legacy.createdAt ?? new Date().toISOString(),
    } as AiMessage;
  }

  return null;
}

function migrateChat(chat: unknown): Chat | null {
  if (!isRecord(chat) || typeof chat.id !== 'string' || typeof chat.title !== 'string' || !Array.isArray(chat.messages)) {
    return null;
  }

  const messages = chat.messages.map(migrateMessage).filter(Boolean) as AiMessage[];
  const mode = chat.mode === 'flash' ? ('flash' as ChatMode) : ('thinking' as ChatMode);
  return {
    id: chat.id,
    title: chat.title,
    messages,
    mode,
    updatedAt: typeof chat.updatedAt === 'string' ? chat.updatedAt : messages.at(-1)?.createdAt ?? new Date().toISOString(),
  };
}

export function loadStoredChats() {
  try {
    const stored = window.localStorage.getItem(chatsStorageKey);
    if (!stored) {
      return [] as Chat[];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [] as Chat[];
    }

    return parsed.map(migrateChat).filter(Boolean) as Chat[];
  } catch {
    return [] as Chat[];
  }
}

export function saveStoredChats(chats: Chat[]) {
  window.localStorage.setItem(chatsStorageKey, JSON.stringify(chats));
}

export function loadStoredSelectedModel() {
  return window.localStorage.getItem(modelStorageKey);
}

export function saveStoredSelectedModel(model: string | null) {
  if (!model) {
    window.localStorage.removeItem(modelStorageKey);
    return;
  }

  window.localStorage.setItem(modelStorageKey, model);
}

export function loadStoredEnabledTools() {
  try {
    const stored = window.localStorage.getItem(enabledToolsStorageKey);
    if (!stored) {
      return {} as Record<string, boolean>;
    }

    const parsed = JSON.parse(stored);
    return isRecord(parsed) ? (parsed as Record<string, boolean>) : ({} as Record<string, boolean>);
  } catch {
    return {} as Record<string, boolean>;
  }
}

export function saveStoredEnabledTools(enabledTools: Record<string, boolean>) {
  window.localStorage.setItem(enabledToolsStorageKey, JSON.stringify(enabledTools));
}

export function loadStoredCustomSystemPrompt() {
  return window.localStorage.getItem(customSystemPromptStorageKey) ?? '';
}

export function saveStoredCustomSystemPrompt(prompt: string) {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) {
    window.localStorage.removeItem(customSystemPromptStorageKey);
    return;
  }

  window.localStorage.setItem(customSystemPromptStorageKey, normalizedPrompt);
}
