import { ModelMessage, OllamaModel, PullProgress } from './types';
import { normalizeModelName, sortModels } from './helpers';

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

export type OllamaErrorKind = 'connection' | 'response';

export class OllamaClientError extends Error {
  kind: OllamaErrorKind;

  constructor(message: string, kind: OllamaErrorKind) {
    super(message);
    this.name = 'OllamaClientError';
    this.kind = kind;
  }
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
  };
}

interface OllamaChatOptions {
  think?: boolean;
}

interface OllamaPullEvent {
  completed?: number;
  digest?: string;
  error?: string;
  status?: string;
  total?: number;
}

async function readJson<T>(response: Response) {
  if (!response.ok) {
    throw new OllamaClientError(`Ollama request failed with ${response.status}.`, 'response');
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

export async function chatWithModel(model: string, messages: ModelMessage[], options: OllamaChatOptions = {}) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        think: options.think,
        messages,
      }),
    });

    const payload = await readJson<OllamaChatResponse>(response);
    return {
      model: payload.model ?? model,
      content: payload.message?.content?.trim() || 'The selected model returned an empty response.',
      thinking: payload.message?.thinking?.trim() || undefined,
    };
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach local Ollama.');
  }
}

async function readEventStream(response: Response, onEvent: (event: OllamaPullEvent) => void) {
  if (!response.ok) {
    throw new Error(`Ollama request failed with ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Ollama did not return a readable response body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      onEvent(JSON.parse(trimmed) as OllamaPullEvent);
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer.trim()) as OllamaPullEvent);
  }
}

export async function pullModel(modelName: string, onProgress: (progress: PullProgress) => void) {
  const model = normalizeModelName(modelName);
  const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model }),
  });

  let streamError: string | null = null;

  await readEventStream(response, (event) => {
    if (event.error) {
      streamError = event.error;
    }

    onProgress({
      model,
      status: event.status ?? 'Working...',
      completed: event.completed,
      total: event.total,
      digest: event.digest,
      error: event.error,
      done: event.status === 'success' || Boolean(event.error),
    });
  });

  if (streamError) {
    throw new Error(streamError);
  }
}
