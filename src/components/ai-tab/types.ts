import { ToolInvocation, ToolResult } from './tools/types';

export interface UserMessage {
  id: string;
  kind: 'user';
  content: string;
  createdAt: string;
  activeVersionId?: string;
  versions?: UserMessageVersion[];
}

export interface UserMessageVersion {
  id: string;
  content: string;
  createdAt: string;
  messagesAfter: AiMessage[];
}

export type AssistantMessageStatus = 'complete' | 'error' | 'cancelled';

interface BaseAssistantTraceStep {
  id: string;
  createdAt: string;
}

export interface AssistantThinkingTraceStep extends BaseAssistantTraceStep {
  kind: 'thinking';
  content: string;
}

export interface AssistantToolCallTraceStep extends BaseAssistantTraceStep {
  kind: 'tool-call';
  invocation: ToolInvocation;
}

export interface AssistantToolResultTraceStep extends BaseAssistantTraceStep {
  kind: 'tool-result';
  result: ToolResult;
}

export type AssistantTraceStep = AssistantThinkingTraceStep | AssistantToolCallTraceStep | AssistantToolResultTraceStep;

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

export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  parameterSize?: string;
  family?: string;
  quantizationLevel?: string;
}

export interface PullProgress {
  model: string;
  status: string;
  completed?: number;
  total?: number;
  digest?: string;
  done: boolean;
  error?: string;
}

export interface CatalogModel {
  name: string;
  title: string;
  description: string;
  tags: string[];
  sizes: string[];
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type OllamaAvailability = 'connecting' | 'ready' | 'no-models' | 'unavailable';
