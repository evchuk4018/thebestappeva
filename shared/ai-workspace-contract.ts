import { AiAttachmentReference, parseAiAttachmentReference } from './ai-attachments-contract';
import { ArtifactCardSummary, parseArtifactCardSummary } from './ai-artifacts-contract';
import { ModelProvider, normalizeModelProvider } from './ai-runtime-contract';
import {
  AssistantTraceStep,
  ToolInvocation,
  ToolResult,
  parseTraceStep,
} from './ai-trace-contract';
export type { AiAttachmentReference } from './ai-attachments-contract';
export type {
  AskUserChoice,
  AskUserPlacement,
  AskUserResponse,
  AskUserStatus,
  AssistantAskUserTraceStep,
  AssistantThinkingTraceStep,
  AssistantToolCallTraceStep,
  AssistantToolResultTraceStep,
  AssistantTraceStep,
  ToolInvocation,
  ToolResult,
} from './ai-trace-contract';

export interface UserMessageVersion {
  id: string;
  content: string;
  createdAt: string;
  messagesAfter: AiMessage[];
}

export interface UserMessage {
  id: string;
  kind: 'user';
  content: string;
  attachments?: AiAttachmentReference[];
  createdAt: string;
  activeVersionId?: string;
  versions?: UserMessageVersion[];
}

export type AssistantMessageStatus = 'complete' | 'error' | 'cancelled';

export interface AssistantMessage {
  id: string;
  kind: 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  trace?: AssistantTraceStep[];
  artifactCards?: ArtifactCardSummary[];
  status: AssistantMessageStatus;
}

export type AiMessage = UserMessage | AssistantMessage;
export type ChatMode = 'thinking' | 'flash';
export type ChatTitleStatus = 'pending' | 'generated' | 'finalized';

export interface Chat {
  id: string;
  title: string;
  titleStatus: ChatTitleStatus;
  messages: AiMessage[];
  activeArtifactId: string | null;
  includedArtifactIds: string[];
  mode: ChatMode;
  updatedAt: string;
}

export interface AiWorkspaceSnapshot {
  chats: Chat[];
  selectedProvider: ModelProvider;
  selectedModel: string | null;
  enabledTools: Record<string, boolean>;
  customSystemPrompt: string;
}

export interface AiPreferences {
  selectedProvider: ModelProvider;
  selectedModel: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}. Expected a string.`);
  }

  return value;
}

function expectOptionalString(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  return expectString(value, field);
}

function parseChatTitleStatus(value: unknown, field: string): ChatTitleStatus {
  if (typeof value === 'undefined') {
    return 'finalized';
  }

  const status = expectString(value, field);
  if (status !== 'pending' && status !== 'generated' && status !== 'finalized') {
    throw new Error(`Invalid ${field}. Expected "pending", "generated", or "finalized".`);
  }

  return status;
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }

  return value;
}

function parseUserMessageVersion(value: unknown, field: string): UserMessageVersion {
  const record = expectRecord(value, field);
  const messagesAfter = Array.isArray(record.messagesAfter)
    ? record.messagesAfter.map((message, index) => parseMessage(message, `${field}.messagesAfter[${index}]`))
    : (() => {
        throw new Error(`Invalid ${field}.messagesAfter. Expected an array.`);
      })();

  return {
    id: expectString(record.id, `${field}.id`),
    content: expectString(record.content, `${field}.content`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    messagesAfter,
  };
}

function parseMessage(value: unknown, field: string): AiMessage {
  const record = expectRecord(value, field);
  const kind = expectString(record.kind, `${field}.kind`);

  if (kind === 'user') {
    return {
      id: expectString(record.id, `${field}.id`),
      kind: 'user',
      content: expectString(record.content, `${field}.content`),
      attachments: Array.isArray(record.attachments)
        ? record.attachments.map((attachment, index) => parseAiAttachmentReference(attachment, `${field}.attachments[${index}]`))
        : undefined,
      createdAt: expectString(record.createdAt, `${field}.createdAt`),
      activeVersionId: expectOptionalString(record.activeVersionId, `${field}.activeVersionId`),
      versions: Array.isArray(record.versions)
        ? record.versions.map((version, index) => parseUserMessageVersion(version, `${field}.versions[${index}]`))
        : undefined,
    };
  }

  if (kind === 'assistant') {
    const status = expectString(record.status, `${field}.status`);
    if (status !== 'complete' && status !== 'error' && status !== 'cancelled') {
      throw new Error(`Invalid ${field}.status. Expected "complete", "error", or "cancelled".`);
    }

    return {
      id: expectString(record.id, `${field}.id`),
      kind: 'assistant',
      content: expectString(record.content, `${field}.content`),
      createdAt: expectString(record.createdAt, `${field}.createdAt`),
      model: expectOptionalString(record.model, `${field}.model`),
      trace: Array.isArray(record.trace)
        ? record.trace.map((step, index) => parseTraceStep(step, `${field}.trace[${index}]`))
        : undefined,
      artifactCards: Array.isArray(record.artifactCards)
        ? record.artifactCards.map((card, index) => parseArtifactCardSummary(card, `${field}.artifactCards[${index}]`))
        : undefined,
      status,
    };
  }

  throw new Error(`Invalid ${field}.kind. Expected "user" or "assistant".`);
}

function parseChat(value: unknown, field: string): Chat {
  const record = expectRecord(value, field);
  const messages = Array.isArray(record.messages)
    ? record.messages.map((message, index) => parseMessage(message, `${field}.messages[${index}]`))
    : (() => {
        throw new Error(`Invalid ${field}.messages. Expected an array.`);
      })();
  const mode = expectString(record.mode, `${field}.mode`);

  if (mode !== 'thinking' && mode !== 'flash') {
    throw new Error(`Invalid ${field}.mode. Expected "thinking" or "flash".`);
  }

  return {
    id: expectString(record.id, `${field}.id`),
    title: expectString(record.title, `${field}.title`),
    titleStatus: parseChatTitleStatus(record.titleStatus, `${field}.titleStatus`),
    messages,
    activeArtifactId: record.activeArtifactId === null || typeof record.activeArtifactId === 'undefined'
      ? null
      : expectString(record.activeArtifactId, `${field}.activeArtifactId`),
    includedArtifactIds: Array.isArray(record.includedArtifactIds)
      ? record.includedArtifactIds.map((artifactId, index) => expectString(artifactId, `${field}.includedArtifactIds[${index}]`))
      : [],
    mode,
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
  };
}

export function createEmptyAiWorkspaceSnapshot(): AiWorkspaceSnapshot {
  return {
    chats: [],
    selectedProvider: 'ollama',
    selectedModel: null,
    enabledTools: {},
    customSystemPrompt: '',
  };
}

export function parseAiWorkspaceSnapshot(value: unknown, field = 'AI workspace snapshot'): AiWorkspaceSnapshot {
  const record = expectRecord(value, field);
  const chats = Array.isArray(record.chats)
    ? record.chats.map((chat, index) => parseChat(chat, `${field}.chats[${index}]`))
    : (() => {
      throw new Error(`Invalid ${field}.chats. Expected an array.`);
    })();
  const selectedProvider = normalizeModelProvider(record.selectedProvider);
  const selectedModel =
    record.selectedModel === null || typeof record.selectedModel === 'undefined'
      ? null
      : expectString(record.selectedModel, `${field}.selectedModel`);
  const enabledTools = expectRecord(record.enabledTools, `${field}.enabledTools`);
  const normalizedEnabledTools = Object.fromEntries(
    Object.entries(enabledTools).map(([toolId, enabled]) => {
      if (typeof enabled !== 'boolean') {
        throw new Error(`Invalid ${field}.enabledTools.${toolId}. Expected a boolean.`);
      }

      return [toolId, enabled];
    }),
  );

  return {
    chats,
    selectedProvider,
    selectedModel,
    enabledTools: normalizedEnabledTools,
    customSystemPrompt: expectString(record.customSystemPrompt, `${field}.customSystemPrompt`),
  };
}

export function parseAiPreferences(value: unknown, field = 'AI preferences'): AiPreferences {
  const record = expectRecord(value, field);
  return {
    selectedProvider: normalizeModelProvider(record.selectedProvider),
    selectedModel:
      record.selectedModel === null || typeof record.selectedModel === 'undefined'
        ? null
        : expectString(record.selectedModel, `${field}.selectedModel`),
  };
}
