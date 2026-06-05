export interface ToolInvocation {
  toolId: string;
  functionName: string;
  args: Record<string, unknown>;
  createdAt: string;
}

export interface ToolResult {
  toolId: string;
  functionName: string;
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
}

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
  createdAt: string;
  activeVersionId?: string;
  versions?: UserMessageVersion[];
}

export type AssistantMessageStatus = 'complete' | 'error' | 'cancelled';

export interface AssistantThinkingTraceStep {
  id: string;
  kind: 'thinking';
  content: string;
  createdAt: string;
}

export interface AssistantToolCallTraceStep {
  id: string;
  kind: 'tool-call';
  invocation: ToolInvocation;
  createdAt: string;
}

export interface AssistantToolResultTraceStep {
  id: string;
  kind: 'tool-result';
  result: ToolResult;
  createdAt: string;
}

export type AssistantTraceStep =
  | AssistantThinkingTraceStep
  | AssistantToolCallTraceStep
  | AssistantToolResultTraceStep;

export interface AssistantMessage {
  id: string;
  kind: 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  trace?: AssistantTraceStep[];
  status: AssistantMessageStatus;
}

export type AiMessage = UserMessage | AssistantMessage;
export type ChatMode = 'thinking' | 'flash';

export interface Chat {
  id: string;
  title: string;
  messages: AiMessage[];
  mode: ChatMode;
  updatedAt: string;
}

export interface AiWorkspaceSnapshot {
  chats: Chat[];
  selectedModel: string | null;
  enabledTools: Record<string, boolean>;
  customSystemPrompt: string;
}

export interface AiPreferences {
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

function expectBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field}. Expected a boolean.`);
  }

  return value;
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }

  return value;
}

function expectStringRecord(value: unknown, field: string) {
  const record = expectRecord(value, field);
  return record;
}

function parseToolInvocation(value: unknown, field: string): ToolInvocation {
  const record = expectRecord(value, field);
  return {
    toolId: expectString(record.toolId, `${field}.toolId`),
    functionName: expectString(record.functionName, `${field}.functionName`),
    args: expectStringRecord(record.args, `${field}.args`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
  };
}

function parseToolResult(value: unknown, field: string): ToolResult {
  const record = expectRecord(value, field);
  const data = typeof record.data === 'undefined' ? undefined : expectStringRecord(record.data, `${field}.data`);
  const error = expectOptionalString(record.error, `${field}.error`);

  return {
    toolId: expectString(record.toolId, `${field}.toolId`),
    functionName: expectString(record.functionName, `${field}.functionName`),
    ok: expectBoolean(record.ok, `${field}.ok`),
    summary: expectString(record.summary, `${field}.summary`),
    data,
    error,
  };
}

function parseTraceStep(value: unknown, field: string): AssistantTraceStep {
  const record = expectRecord(value, field);
  const base = {
    id: expectString(record.id, `${field}.id`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
  };

  switch (record.kind) {
    case 'thinking':
      return { ...base, kind: 'thinking', content: expectString(record.content, `${field}.content`) };
    case 'tool-call':
      return { ...base, kind: 'tool-call', invocation: parseToolInvocation(record.invocation, `${field}.invocation`) };
    case 'tool-result':
      return { ...base, kind: 'tool-result', result: parseToolResult(record.result, `${field}.result`) };
    default:
      throw new Error(`Invalid ${field}.kind. Expected "thinking", "tool-call", or "tool-result".`);
  }
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
    messages,
    mode,
    updatedAt: expectString(record.updatedAt, `${field}.updatedAt`),
  };
}

export function createEmptyAiWorkspaceSnapshot(): AiWorkspaceSnapshot {
  return {
    chats: [],
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
  const selectedModel = record.selectedModel === null ? null : expectString(record.selectedModel, `${field}.selectedModel`);
  const enabledTools = expectRecord(record.enabledTools, `${field}.enabledTools`);
  const normalizedEnabledTools = Object.fromEntries(
    Object.entries(enabledTools).map(([toolId, enabled]) => [toolId, expectBoolean(enabled, `${field}.enabledTools.${toolId}`)]),
  );

  return {
    chats,
    selectedModel,
    enabledTools: normalizedEnabledTools,
    customSystemPrompt: expectString(record.customSystemPrompt, `${field}.customSystemPrompt`),
  };
}

export function parseAiPreferences(value: unknown, field = 'AI preferences'): AiPreferences {
  const record = expectRecord(value, field);
  return {
    selectedModel: record.selectedModel === null ? null : expectString(record.selectedModel, `${field}.selectedModel`),
  };
}
