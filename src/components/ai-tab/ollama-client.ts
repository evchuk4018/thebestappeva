import { PullProgress } from './types';
export { chatWithModel, getModelCapabilities, listModels, OllamaClientError } from '../../lib/ollama/runtime';
export type { OllamaChatMessage, OllamaModel, OllamaToolDefinition } from '../../lib/ollama/runtime';

function normalizeModelName(name: string) {
  return name.trim();
}

interface OllamaPullEvent {
  completed?: number;
  digest?: string;
  error?: string;
  status?: string;
  total?: number;
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
      if (trimmed) {
        onEvent(JSON.parse(trimmed) as OllamaPullEvent);
      }
    }
  }

  if (buffer.trim()) {
    onEvent(JSON.parse(buffer.trim()) as OllamaPullEvent);
  }
}

export async function pullModel(modelName: string, onProgress: (progress: PullProgress) => void) {
  const model = normalizeModelName(modelName);
  const response = await fetch('http://127.0.0.1:11434/api/pull', {
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
