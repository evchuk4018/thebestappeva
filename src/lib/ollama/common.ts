export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  parameterSize?: string;
  family?: string;
  quantizationLevel?: string;
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  thinking?: string;
  tool_name?: string;
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
}

export type OllamaChatToolCalls = NonNullable<OllamaChatMessage['tool_calls']>;

export type OllamaChatStreamEvent =
  | { type: 'thinking'; delta: string; snapshot: string; model: string }
  | { type: 'content'; delta: string; snapshot: string; model: string }
  | { type: 'tool-calls'; toolCalls: OllamaChatToolCalls; model: string }
  | { type: 'done'; model: string };

export interface OllamaToolDefinition {
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

export class OllamaClientError extends Error {
  kind: 'connection' | 'response';

  constructor(message: string, kind: 'connection' | 'response') {
    super(message);
    this.name = 'OllamaClientError';
    this.kind = kind;
  }
}

export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

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
