import { chatWithModel, streamChatWithModel } from './chat-stream';
import { normalizeOllamaError, OllamaClientError } from './common';
import type { AiRuntimeConfig, ModelProvider, OllamaModel } from './common';

async function readJson<T>(response: Response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new OllamaClientError(payload?.error?.trim() || `The local AI server failed with ${response.status}.`, 'response');
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new OllamaClientError('The local AI server returned invalid JSON.', 'response');
  }
}

function sortModels(models: OllamaModel[]) {
  return [...models].sort((left, right) => Date.parse(right.modifiedAt ?? '') - Date.parse(left.modifiedAt ?? ''));
}

export async function loadRuntimeConfig() {
  try {
    const response = await fetch('/api/ai/runtime-config');
    return await readJson<AiRuntimeConfig>(response);
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach the local AI server.');
  }
}

export async function listModels(provider: ModelProvider = 'ollama') {
  const payload = await loadRuntimeConfig();
  return sortModels(payload.modelOptions.filter((model) => model.provider === provider));
}

export async function getModelCapabilities(model: string, provider: ModelProvider = 'ollama') {
  try {
    const response = await fetch(`/api/ai/model-capabilities?provider=${encodeURIComponent(provider)}&model=${encodeURIComponent(model)}`);
    const payload = await readJson<{ capabilities?: string[] }>(response);
    return Array.isArray(payload.capabilities) ? payload.capabilities : [];
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to inspect the selected model.');
  }
}

export { chatWithModel, OllamaClientError, streamChatWithModel };
export type {
  ModelProvider,
  OllamaChatMessage,
  OllamaChatStreamEvent,
  OllamaChatToolCalls,
  OllamaModel,
  OllamaToolDefinition,
  RuntimeOptions,
} from './common';
