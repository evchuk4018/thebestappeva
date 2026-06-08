import { chatWithModel, streamChatWithModel } from './chat-stream';
import { normalizeOllamaError, OllamaClientError, OllamaModel, OLLAMA_BASE_URL } from './common';

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

const modelCapabilities = new Map<string, string[]>();

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

export { chatWithModel, OllamaClientError, streamChatWithModel };
export type {
  OllamaChatMessage,
  OllamaChatStreamEvent,
  OllamaChatToolCalls,
  OllamaModel,
  OllamaToolDefinition,
} from './common';
