import type { RuntimeModel } from '../../../shared/ai-runtime-contract';

export type {
  AiMessage,
  AiAttachmentReference,
  AiPreferences,
  AiWorkspaceSnapshot,
  AskUserChoice,
  AskUserPlacement,
  AskUserResponse,
  AskUserStatus,
  AssistantAskUserTraceStep,
  AssistantMessage,
  AssistantMessageStatus,
  AssistantThinkingTraceStep,
  AssistantToolCallTraceStep,
  AssistantToolResultTraceStep,
  AssistantTraceStep,
  Chat,
  ChatMode,
  ToolInvocation,
  ToolResult,
  UserMessage,
  UserMessageVersion,
} from '../../../shared/ai-workspace-contract';
export type { ArtifactCardSummary } from '../../../shared/ai-artifacts-contract';
export type { AiAttachmentHealth, AiParsedAttachment } from '../../../shared/ai-attachments-contract';
export type {
  AiRuntimeConfig,
  ModelChatMessage,
  ModelChatStreamEvent,
  ModelChatToolCalls,
  ModelProvider,
  ModelToolDefinition,
  RuntimeModel,
  RuntimeProviderOption,
} from '../../../shared/ai-runtime-contract';

export type OllamaModel = RuntimeModel;

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
