import { ModelMessage, OllamaModel, PullProgress } from './types';
import { normalizeModelName, sortModels } from './helpers';

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

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
    throw new Error(`Ollama request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listModels() {
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
}

export async function chatWithModel(model: string, messages: ModelMessage[], options: OllamaChatOptions = {}) {
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
