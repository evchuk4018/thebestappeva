import { normalizeModelProvider } from '../../shared/ai-runtime-contract';
import type { ModelProvider } from '../../shared/ai-runtime-contract';
import { serverConfig } from '../config';
import { createDeepSeekProvider } from './deepseek';
import { createOllamaProvider } from './ollama';

const providers = {
  ollama: createOllamaProvider(),
  deepseek: createDeepSeekProvider(),
};

export function getModelProvider(provider: unknown) {
  return providers[normalizeModelProvider(provider)];
}

export function getDefaultModelProviderId(): ModelProvider {
  return normalizeModelProvider(serverConfig.modelProvider);
}

export function listModelProviders() {
  return Object.values(providers);
}
