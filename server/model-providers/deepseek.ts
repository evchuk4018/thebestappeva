import { serverConfig } from '../config';
import { HttpError } from '../http';
import { createThinkingDeltaParser, normalizeThinkingOutput } from './thinking-parser';
import { applyDeepSeekToolCallDeltas, finalizeDeepSeekToolCalls, readServerSentEvents } from './stream-parsers';
import type { ModelChatMessage } from '../../shared/ai-runtime-contract';
import type { RuntimeModel } from '../../shared/ai-runtime-contract';
import type { ModelProviderDefinition, ProviderChatOptions } from './types';

const deepSeekModelLabels: Record<string, string> = {
  'deepseek-v4-pro': 'DeepSeek V4 Pro',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
};

const deepSeekModelOrder = ['deepseek-v4-flash', 'deepseek-v4-pro'];
const deepSeekModelAliases: Record<string, string> = {
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-flash',
};

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

function buildToolResponseMessages(messages: ModelChatMessage[]) {
  return messages.map((message) => {
    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls?.map((toolCall, index) => ({
          id: toolCall.id ?? `tool-${index}`,
          type: 'function',
          function: {
            name: toolCall.function.name,
            arguments: JSON.stringify(toolCall.function.arguments ?? {}),
          },
        })),
      };
    }

    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.tool_call_id ?? `tool-${message.tool_name ?? 'result'}`,
        content: message.content,
      };
    }

    return {
      role: message.role,
      content: message.content,
    };
  });
}

function buildRequestBody(options: ProviderChatOptions) {
  return {
    model: options.model,
    stream: true,
    messages: buildToolResponseMessages(options.messages),
    tools: options.tools?.length ? options.tools : undefined,
    max_tokens: options.runtimeOptions?.maxOutputTokens,
    temperature: options.runtimeOptions?.temperature,
    thinking: options.think ? { type: 'enabled' } : undefined,
  };
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

      const response = await fetch(`${serverConfig.deepseekBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serverConfig.deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        signal: options.signal,
        body: JSON.stringify(buildRequestBody(options)),
      });

      const contentParser = createThinkingDeltaParser();
      let replyModel = options.model;
      let content = '';
      let thinking = '';
      let toolCalls: ReturnType<typeof finalizeDeepSeekToolCalls>;
      let toolSignature = '';
      const pendingToolCalls: Parameters<typeof applyDeepSeekToolCallDeltas>[0] = [];

      await readServerSentEvents<{
        model?: string;
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning_content?: string;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: {
                name?: string;
                arguments?: string;
              };
            }>;
          };
        }>;
      }>(response, (chunk) => {
        replyModel = chunk.model ?? replyModel;
        const delta = chunk.choices?.[0]?.delta;
        const reasoningDelta = delta?.reasoning_content ?? '';
        if (reasoningDelta) {
          thinking += reasoningDelta;
          options.onEvent?.({ type: 'thinking', delta: reasoningDelta, snapshot: thinking, model: replyModel });
        }

        const contentDelta = delta?.content ?? '';
        if (contentDelta) {
          const parsed = contentParser.push(contentDelta);
          if (parsed.thinking) {
            thinking += parsed.thinking;
            options.onEvent?.({ type: 'thinking', delta: parsed.thinking, snapshot: thinking, model: replyModel });
          }
          if (parsed.content) {
            content += parsed.content;
            options.onEvent?.({ type: 'content', delta: parsed.content, snapshot: content, model: replyModel });
          }
        }

        if (delta?.tool_calls?.length) {
          toolCalls = finalizeDeepSeekToolCalls(applyDeepSeekToolCallDeltas(pendingToolCalls, delta.tool_calls));
          const signature = JSON.stringify(toolCalls);
          if (toolCalls?.length && signature !== toolSignature) {
            toolSignature = signature;
            options.onEvent?.({ type: 'tool-calls', toolCalls, model: replyModel });
          }
        }
      });

      const remainder = contentParser.finish();
      const normalized = normalizeThinkingOutput(`${content}${remainder.content}`, `${thinking}${remainder.thinking}`);
      return {
        model: replyModel,
        content: normalized.content || (toolCalls?.length ? '' : 'The selected model returned an empty response.'),
        thinking: normalized.thinking || undefined,
        toolCalls,
      };
    },
  };
}
