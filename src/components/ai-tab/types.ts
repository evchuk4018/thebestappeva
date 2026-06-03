import { ToolInvocation, ToolResult } from './tools/types';

export interface UserMessage {
  id: string;
  kind: 'user';
  content: string;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  kind: 'assistant';
  content: string;
  createdAt: string;
  model?: string;
  thinking?: string;
}

export interface ToolCallMessage {
  id: string;
  kind: 'tool-call';
  createdAt: string;
  invocation: ToolInvocation;
}

export interface ToolResultMessage {
  id: string;
  kind: 'tool-result';
  createdAt: string;
  result: ToolResult;
}

export type AiMessage = UserMessage | AssistantMessage | ToolCallMessage | ToolResultMessage;

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
