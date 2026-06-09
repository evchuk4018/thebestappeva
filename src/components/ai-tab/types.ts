export type {
  AiMessage,
  AiAttachmentReference,
  AiWorkspaceSnapshot,
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
