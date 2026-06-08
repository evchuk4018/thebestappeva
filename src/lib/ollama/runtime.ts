export interface OllamaModel {
  name: string;
  modifiedAt: string;
  size: number;
  parameterSize?: string;
  family?: string;
  quantizationLevel?: string;
}

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    modified_at: string;
    size: number;
    details?: {
      family?: string;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    content?: string;
    thinking?: string;
    tool_calls?: OllamaToolCall[];
  };
}

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
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

const modelCapabilities = new Map<string, string[]>();

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        {
          type: 'string' | 'number' | 'boolean';
          description: string;
        }
      >;
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

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

function sortModels(models: OllamaModel[]) {
  return [...models].sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt));
}

async function readJson<T>(response: Response) {
  if (!response.ok) {
    const rawBody = (await response.text()).trim();
    let detail = rawBody;

    if (!rawBody) {
      throw new OllamaClientError(`Ollama request failed with ${response.status}.`, 'response');
    }

    try {
      const payload = JSON.parse(rawBody) as { error?: string };
      detail = typeof payload.error === 'string' ? payload.error.trim() : rawBody;
    } catch {
      detail = rawBody;
    }

    throw new OllamaClientError(
      detail && !(detail === rawBody && (rawBody.startsWith('{') || rawBody.startsWith('[')))
        ? `Ollama request failed with ${response.status}: ${detail}`
        : `Ollama request failed with ${response.status}.`,
      'response',
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new OllamaClientError('Ollama returned invalid JSON.', 'response');
  }
}

function normalizeOllamaError(error: unknown, fallbackMessage: string) {
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

export async function listModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    const payload = await readJson<OllamaTagsResponse>(response);

    return sortModels(
      (payload.models ?? []).map((model) => ({
        name: model.name,
        modifiedAt: model.modified_at,
        size: model.size,
        family: model.details?.family,
        parameterSize: model.details?.parameter_size,
        quantizationLevel: model.details?.quantization_level,
      })),
    );
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach local Ollama.');
  }
}

export async function getModelCapabilities(model: string) {
  const cached = modelCapabilities.get(model);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, verbose: false }),
    });
    const payload = await readJson<{ capabilities?: string[] }>(response);
    const capabilities = Array.isArray(payload.capabilities) ? payload.capabilities : [];
    modelCapabilities.set(model, capabilities);
    return capabilities;
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to inspect the selected Ollama model.');
  }
}

export async function chatWithModel(model: string, messages: OllamaChatMessage[], options: {
  think?: boolean;
  tools?: OllamaToolDefinition[];
  signal?: AbortSignal;
} = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        model,
        stream: false,
        think: options.think,
        messages,
        tools: options.tools?.length ? options.tools : undefined,
      }),
    });

    const payload = await readJson<OllamaChatResponse>(response);
    const toolCalls =
      payload.message?.tool_calls
        ?.map((toolCall) => {
          const functionName = toolCall.function?.name?.trim();
          if (!functionName) {
            return null;
          }

          return {
            function: {
              name: functionName,
              arguments: toolCall.function?.arguments ?? {},
            },
          };
        })
        .filter(Boolean) as OllamaChatMessage['tool_calls'];
    const content = payload.message?.content?.trim() || '';

    return {
      model: payload.model ?? model,
      content: content || (toolCalls?.length ? '' : 'The selected model returned an empty response.'),
      thinking: payload.message?.thinking?.trim() || undefined,
      toolCalls,
    };
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach local Ollama.');
  }
}
