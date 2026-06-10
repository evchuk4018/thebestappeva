export interface ToolInvocation {
  toolId: string;
  functionName: string;
  args: Record<string, unknown>;
  createdAt: string;
  toolCallId?: string;
}

export interface ToolResult {
  toolId: string;
  functionName: string;
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
  toolCallId?: string;
}

export interface AskUserChoice {
  id: string;
  label: string;
  description?: string;
}

export type AskUserPlacement = 'inline_trace' | 'end_of_response';
export type AskUserStatus = 'pending' | 'answered' | 'skipped';

export type AskUserResponse =
  | {
      kind: 'choice';
      choiceId: string;
      label: string;
      description?: string;
    }
  | {
      kind: 'open-ended';
      text: string;
    }
  | {
      kind: 'skip';
      reason?: string;
    };

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

export interface AssistantAskUserTraceStep {
  id: string;
  kind: 'ask-user';
  toolCallId: string;
  question: string;
  choices: AskUserChoice[];
  allowOpenEnded: boolean;
  openEndedPlaceholder?: string;
  placement: AskUserPlacement;
  required: boolean;
  status: AskUserStatus;
  response?: AskUserResponse;
  createdAt: string;
}

export type AssistantTraceStep =
  | AssistantThinkingTraceStep
  | AssistantToolCallTraceStep
  | AssistantToolResultTraceStep
  | AssistantAskUserTraceStep;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }

  return value;
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

function expectStringRecord(value: unknown, field: string) {
  return expectRecord(value, field);
}

function parseAskUserChoice(value: unknown, field: string): AskUserChoice {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    label: expectString(record.label, `${field}.label`),
    description: expectOptionalString(record.description, `${field}.description`),
  };
}

function parseAskUserResponse(value: unknown, field: string): AskUserResponse {
  const record = expectRecord(value, field);

  switch (record.kind) {
    case 'choice':
      return {
        kind: 'choice',
        choiceId: expectString(record.choiceId, `${field}.choiceId`),
        label: expectString(record.label, `${field}.label`),
        description: expectOptionalString(record.description, `${field}.description`),
      };
    case 'open-ended':
      return {
        kind: 'open-ended',
        text: expectString(record.text, `${field}.text`),
      };
    case 'skip':
      return {
        kind: 'skip',
        reason: expectOptionalString(record.reason, `${field}.reason`),
      };
    default:
      throw new Error(`Invalid ${field}.kind. Expected "choice", "open-ended", or "skip".`);
  }
}

export function parseToolInvocation(value: unknown, field: string): ToolInvocation {
  const record = expectRecord(value, field);
  return {
    toolId: expectString(record.toolId, `${field}.toolId`),
    functionName: expectString(record.functionName, `${field}.functionName`),
    args: expectStringRecord(record.args, `${field}.args`),
    createdAt: expectString(record.createdAt, `${field}.createdAt`),
    toolCallId: expectOptionalString(record.toolCallId, `${field}.toolCallId`),
  };
}

export function parseToolResult(value: unknown, field: string): ToolResult {
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
    toolCallId: expectOptionalString(record.toolCallId, `${field}.toolCallId`),
  };
}

export function parseTraceStep(value: unknown, field: string): AssistantTraceStep {
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
    case 'ask-user': {
      const placement = expectString(record.placement, `${field}.placement`);
      const status = expectString(record.status, `${field}.status`);
      if (placement !== 'inline_trace' && placement !== 'end_of_response') {
        throw new Error(`Invalid ${field}.placement. Expected "inline_trace" or "end_of_response".`);
      }
      if (status !== 'pending' && status !== 'answered' && status !== 'skipped') {
        throw new Error(`Invalid ${field}.status. Expected "pending", "answered", or "skipped".`);
      }

      return {
        ...base,
        kind: 'ask-user',
        toolCallId: expectString(record.toolCallId, `${field}.toolCallId`),
        question: expectString(record.question, `${field}.question`),
        choices: Array.isArray(record.choices)
          ? record.choices.map((choice, index) => parseAskUserChoice(choice, `${field}.choices[${index}]`))
          : (() => {
              throw new Error(`Invalid ${field}.choices. Expected an array.`);
            })(),
        allowOpenEnded: expectBoolean(record.allowOpenEnded, `${field}.allowOpenEnded`),
        openEndedPlaceholder: expectOptionalString(record.openEndedPlaceholder, `${field}.openEndedPlaceholder`),
        placement,
        required: expectBoolean(record.required, `${field}.required`),
        status,
        response: typeof record.response === 'undefined' ? undefined : parseAskUserResponse(record.response, `${field}.response`),
      };
    }
    default:
      throw new Error(`Invalid ${field}.kind. Expected "thinking", "tool-call", "tool-result", or "ask-user".`);
  }
}
