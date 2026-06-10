import { serverConfig } from '../config';
import { HttpError } from '../http';
import { normalizeThinkingOutput, createThinkingDeltaParser } from './thinking-parser';
import { normalizeToolCalls, readNdjsonStream } from './stream-parsers';
import type { RuntimeModel } from '../../shared/ai-runtime-contract';
import type { ModelProviderDefinition, ProviderChatOptions, ProviderStatusSnapshot } from './types';

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

const nonStreamingToolModels = new Set<string>();

function sortModels(models: RuntimeModel[]) {
  return [...models].sort((left, right) => Date.parse(right.modifiedAt ?? '') - Date.parse(left.modifiedAt ?? ''));
}

function buildStatus(detail: string, configured: boolean, status: ProviderStatusSnapshot['option']['status'], models: RuntimeModel[]) {
  return {
    option: {
      value: 'ollama' as const,
      label: 'Ollama',
      configured,
      status,
      detail,
      defaultModel: serverConfig.ollamaModel,
      defaultModelLabel: serverConfig.modelLabel,
    },
    models,
  };
}

async function readJson<T>(response: Response, fallback: string) {
  if (!response.ok) {
    const message = (await response.text()).trim() || fallback;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError(502, 'Ollama returned invalid JSON.');
  }
}

async function requestChat(options: ProviderChatOptions, stream: boolean) {
  const response = await fetch(`${serverConfig.ollamaHost}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify({
      model: options.model,
      stream,
      think: options.think,
      messages: options.messages,
      tools: options.tools?.length ? options.tools : undefined,
      options: {
        num_ctx: options.runtimeOptions?.contextWindowSize,
        num_predict: options.runtimeOptions?.maxOutputTokens,
        temperature: options.runtimeOptions?.temperature,
      },
    }),
  });

  const contentParser = createThinkingDeltaParser();
  let replyModel = options.model;
  let content = '';
  let thinking = '';
  let toolCalls: ReturnType<typeof normalizeToolCalls>;
  let toolSignature = '';

  await readNdjsonStream<{
    model?: string;
    message?: {
      content?: string;
      thinking?: string;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: Record<string, unknown> } }>;
    };
    error?: string;
  }>(response, (chunk) => {
    if (chunk.error?.trim()) {
      throw new HttpError(502, chunk.error.trim());
    }

    replyModel = chunk.model ?? replyModel;
    const thinkingDelta = chunk.message?.thinking ?? '';
    if (thinkingDelta) {
      thinking += thinkingDelta;
      options.onEvent?.({ type: 'thinking', delta: thinkingDelta, snapshot: thinking, model: replyModel });
    }

    const contentDelta = chunk.message?.content ?? '';
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

    const nextToolCalls = normalizeToolCalls(chunk.message?.tool_calls);
    if (nextToolCalls?.length) {
      const signature = JSON.stringify(nextToolCalls);
      toolCalls = nextToolCalls;
      if (signature !== toolSignature) {
        toolSignature = signature;
        options.onEvent?.({ type: 'tool-calls', toolCalls: nextToolCalls, model: replyModel });
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
}

export function createOllamaProvider(): ModelProviderDefinition {
  return {
    id: 'ollama',
    label: 'Ollama',
    async getCapabilities(model) {
      const response = await fetch(`${serverConfig.ollamaHost}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, verbose: false }),
      });
      const payload = await readJson<{ capabilities?: string[] }>(response, 'Unable to inspect the selected Ollama model.');
      return Array.isArray(payload.capabilities) ? payload.capabilities : [];
    },
    async getStatus() {
      try {
        const response = await fetch(`${serverConfig.ollamaHost}/api/tags`);
        const payload = await readJson<OllamaTagsResponse>(response, 'Unable to reach local Ollama.');
        const models = sortModels(
          (payload.models ?? []).map((model) => ({
            name: model.name,
            label: model.name,
            provider: 'ollama' as const,
            modifiedAt: model.modified_at,
            size: model.size,
            family: model.details?.family,
            parameterSize: model.details?.parameter_size,
            quantizationLevel: model.details?.quantization_level,
          })),
        );
        return buildStatus(`Connected to ${serverConfig.ollamaHost}.`, true, 'ready', models);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to reach local Ollama.';
        return buildStatus(message, true, 'unavailable', []);
      }
    },
    async callChatStream(options) {
      try {
        const hasTools = Boolean(options.tools?.length);
        const shouldStream = !hasTools || !nonStreamingToolModels.has(options.model);
        try {
          return await requestChat(options, shouldStream);
        } catch (error) {
          if (!shouldStream || !hasTools || !(error instanceof HttpError) || !/unexpected end of json input/i.test(error.message)) {
            throw error;
          }

          nonStreamingToolModels.add(options.model);
          return await requestChat(options, false);
        }
      } catch (error) {
        throw error instanceof HttpError ? error : new HttpError(502, 'Unable to reach local Ollama.');
      }
    },
  };
}
