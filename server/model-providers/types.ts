import type { ModelChatMessage, ModelChatStreamEvent, ModelChatToolCalls, ModelProvider, ModelToolDefinition, RuntimeModel, RuntimeOptions, RuntimeProviderOption } from '../../shared/ai-runtime-contract';

export interface ProviderStatusSnapshot {
  option: RuntimeProviderOption;
  models: RuntimeModel[];
}

export interface ProviderChatResult {
  model: string;
  content: string;
  thinking?: string;
  toolCalls?: ModelChatToolCalls;
}

export interface ProviderChatOptions {
  model: string;
  messages: ModelChatMessage[];
  think?: boolean;
  tools?: ModelToolDefinition[];
  runtimeOptions?: RuntimeOptions;
  signal?: AbortSignal;
  onEvent?: (event: Exclude<ModelChatStreamEvent, { type: 'done' } | { type: 'error' }>) => void;
}

export interface ModelProviderDefinition {
  id: ModelProvider;
  label: string;
  getCapabilities: (model: string) => Promise<string[]>;
  getStatus: () => Promise<ProviderStatusSnapshot>;
  callChatStream: (options: ProviderChatOptions) => Promise<ProviderChatResult>;
}
