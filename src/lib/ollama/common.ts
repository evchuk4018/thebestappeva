import type {
  AiRuntimeConfig,
  ModelChatMessage as OllamaChatMessage,
  ModelChatStreamEvent as OllamaChatStreamEvent,
  ModelChatToolCalls as OllamaChatToolCalls,
  ModelProvider,
  ModelToolDefinition as OllamaToolDefinition,
  RuntimeModel as OllamaModel,
  RuntimeOptions,
} from '../../../shared/ai-runtime-contract';

export type {
  AiRuntimeConfig,
  ModelProvider,
  OllamaChatMessage,
  OllamaChatStreamEvent,
  OllamaChatToolCalls,
  OllamaModel,
  OllamaToolDefinition,
  RuntimeOptions,
};

export class OllamaClientError extends Error {
  kind: 'connection' | 'response';

  constructor(message: string, kind: 'connection' | 'response') {
    super(message);
    this.name = 'OllamaClientError';
    this.kind = kind;
  }
}

export function normalizeOllamaError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TurnAbortedError')) {
    throw error;
  }

  if (error instanceof OllamaClientError) {
    return error;
  }

  if (error instanceof Error && error.name === 'TypeError') {
    return new OllamaClientError(fallbackMessage, 'connection');
  }

  if (error instanceof Error) {
    return new OllamaClientError(error.message, 'response');
  }

  return new OllamaClientError(fallbackMessage, 'response');
}
