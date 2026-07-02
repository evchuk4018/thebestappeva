import { chatWithModel, streamChatWithModel } from './chat-stream';
import { normalizeOllamaError, OllamaClientError } from './common';
import type { AiRuntimeConfig, ModelProvider, OllamaModel } from './common';
import { requestJson } from '../api';

function sortModels(models: OllamaModel[]) {
  return [...models].sort((left, right) => Date.parse(right.modifiedAt ?? '') - Date.parse(left.modifiedAt ?? ''));
}

export async function loadRuntimeConfig() {
  try {
    return await requestJson<AiRuntimeConfig>('/ai/runtime-config');
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to load AI runtime configuration.');
  }
}

export async function listModels(provider: ModelProvider = 'ollama') {
  const payload = await loadRuntimeConfig();
  return sortModels(payload.modelOptions.filter((model) => model.provider === provider));
}

export async function getModelCapabilities(model: string, provider: ModelProvider = 'ollama') {
  try {
    const payload = await requestJson<{ capabilities?: string[] }>('/ai/model-capabilities', {
      query: { provider, model },
    });
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
