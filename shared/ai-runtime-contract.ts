export type ModelProvider = 'ollama' | 'deepseek';

export interface RuntimeModel {
  name: string;
  provider: ModelProvider;
  label?: string;
  modifiedAt?: string;
  size?: number;
  parameterSize?: string;
  family?: string;
  quantizationLevel?: string;
  capabilities?: string[];
}

export interface ModelChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  thinking?: string;
  tool_name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id?: string;
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
}

export type ModelChatToolCalls = NonNullable<ModelChatMessage['tool_calls']>;

export type ModelChatStreamEvent =
  | { type: 'thinking'; delta: string; snapshot: string; model: string }
  | { type: 'content'; delta: string; snapshot: string; model: string }
  | { type: 'tool-calls'; toolCalls: ModelChatToolCalls; model: string }
  | { type: 'done'; model: string }
  | { type: 'error'; error: string; model?: string };

export interface ModelToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, Record<string, unknown>>;
      required?: string[];
    };
  };
}

export interface RuntimeProviderOption {
  value: ModelProvider;
  label: string;
  configured: boolean;
  status: 'ready' | 'missing-env' | 'unavailable';
  detail: string;
  defaultModel: string | null;
  defaultModelLabel: string | null;
}

export interface AiRuntimeConfig {
  defaultProvider: ModelProvider;
  providerOptions: RuntimeProviderOption[];
  modelOptions: RuntimeModel[];
}

export interface RuntimeOptions {
  contextWindowSize?: number;
  maxOutputTokens?: number;
  temperature?: number;
}

export function normalizeModelProvider(value: unknown, fallback: ModelProvider = 'ollama'): ModelProvider {
  return value === 'deepseek' ? 'deepseek' : value === 'ollama' ? 'ollama' : fallback;
}
