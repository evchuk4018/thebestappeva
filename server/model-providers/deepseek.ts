import { serverConfig } from '../config';
import { HttpError } from '../http';
import { requestDeepSeekChat } from './deepseek-chat';
import type { RuntimeModel } from '../../shared/ai-runtime-contract';
import type { ModelProviderDefinition } from './types';

const deepSeekModelLabels: Record<string, string> = {
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
};

const deepSeekModelOrder = ['deepseek-v4-flash', 'deepseek-v4-pro'];
const deepSeekModelAliases: Record<string, string> = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
};
const nonStreamingToolModels = new Set<string>();

interface DeepSeekModelsResponse {
  data?: Array<{ id?: unknown; name?: unknown }>;
  models?: Array<{ id?: unknown; name?: unknown }>;
}

function assertConfigured() {
  if (!serverConfig.deepseekApiKey) {
    throw new HttpError(500, 'DeepSeek provider selected but DEEPSEEK_API_KEY is not set.');
  }
}

function normalizeModelName(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }
  const name = value.trim();
  if (!name) {
    return null;
  }
  return deepSeekModelAliases[name] ?? name;
}

function extractDeepSeekModelRecords(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload as Array<string | { id?: unknown; name?: unknown }>;
  }
  if (Array.isArray((payload as DeepSeekModelsResponse | null)?.data)) {
    return (payload as DeepSeekModelsResponse).data as Array<string | { id?: unknown; name?: unknown }>;
  }
  if (Array.isArray((payload as DeepSeekModelsResponse | null)?.models)) {
    return (payload as DeepSeekModelsResponse).models as Array<string | { id?: unknown; name?: unknown }>;
  }
  return [];
}

function parseDeepSeekModels(payload: unknown): RuntimeModel[] {
  const records = extractDeepSeekModelRecords(payload);
  const seen = new Set<string>();

  return deepSeekModelOrder.flatMap((modelName) => {
    const match = records.find((record) => {
      if (typeof record === 'string') {
        return normalizeModelName(record) === modelName;
      }
      const candidate = record as { id?: unknown; name?: unknown };
      return normalizeModelName(candidate.id) === modelName || normalizeModelName(candidate.name) === modelName;
    });
    if (!match || seen.has(modelName)) {
      return [];
    }

    seen.add(modelName);
    return [{
      name: modelName,
      label: deepSeekModelLabels[modelName],
      provider: 'deepseek' as const,
      capabilities: [],
    }];
  });
}

async function readJson<T>(response: Response, fallback: string) {
  if (!response.ok) {
    const message = (await response.text()).trim() || fallback;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError(502, 'DeepSeek returned invalid JSON.');
  }
}

async function loadDeepSeekModels() {
  assertConfigured();
  const response = await fetch(`${serverConfig.deepseekBaseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${serverConfig.deepseekApiKey}`,
    },
  });
  const payload = await readJson<DeepSeekModelsResponse>(response, 'Unable to load DeepSeek models.');
  return parseDeepSeekModels(payload);
}

export function createDeepSeekProvider(): ModelProviderDefinition {
  return {
    id: 'deepseek',
    label: 'DeepSeek',
    async getCapabilities() {
      return [];
    },
    async getStatus() {
      const configured = Boolean(serverConfig.deepseekApiKey);
      if (!configured) {
        return {
          option: {
            value: 'deepseek' as const,
            label: 'DeepSeek',
            configured: false,
            status: 'missing-env',
            detail: 'DeepSeek API key missing from server environment.',
            defaultModel: null,
            defaultModelLabel: null,
          },
          models: [],
        };
      }

      try {
        const models = await loadDeepSeekModels();
        return {
          option: {
            value: 'deepseek' as const,
            label: 'DeepSeek',
            configured: true,
            status: 'ready',
            detail: models.length
              ? `Loaded ${models.length} DeepSeek model${models.length === 1 ? '' : 's'} from /models.`
              : 'DeepSeek responded without any supported V4 models.',
            defaultModel: models[0]?.name ?? null,
            defaultModelLabel: models[0]?.label ?? null,
          },
          models,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load DeepSeek models.';
        return {
          option: {
            value: 'deepseek' as const,
            label: 'DeepSeek',
            configured: true,
            status: 'unavailable',
            detail: message,
            defaultModel: null,
            defaultModelLabel: null,
          },
          models: [],
        };
      }
    },
    async callChatStream(options) {
      assertConfigured();
      const hasTools = Boolean(options.tools?.length);
      const shouldStream = !hasTools || !nonStreamingToolModels.has(options.model);
      try {
        return await requestDeepSeekChat(options, shouldStream);
      } catch (error) {
        if (
          !shouldStream
          || !hasTools
          || !(error instanceof HttpError)
          || !/invalid tool arguments/i.test(error.message)
        ) {
          throw error;
        }

        nonStreamingToolModels.add(options.model);
        return await requestDeepSeekChat(options, false);
      }
    },
  };
}
