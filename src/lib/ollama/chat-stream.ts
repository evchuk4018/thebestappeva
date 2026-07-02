import { normalizeOllamaError, OllamaClientError } from './common';
import type { OllamaChatMessage, OllamaChatStreamEvent, OllamaChatToolCalls, OllamaToolDefinition } from './common';
import type { ModelProvider } from '../../../shared/ai-runtime-contract';
import type { RuntimeOptions } from './common';
import { streamJsonLines } from '../api';

export async function streamChatWithModel(
  model: string,
  messages: OllamaChatMessage[],
  options: {
    provider?: ModelProvider;
    think?: boolean;
    tools?: OllamaToolDefinition[];
    runtimeOptions?: RuntimeOptions;
    signal?: AbortSignal;
    onEvent?: (event: OllamaChatStreamEvent) => void;
  } = {},
) {
  try {
    let replyModel = model;
    let content = '';
    let thinking = '';
    let toolCalls: OllamaChatToolCalls | undefined;

    await streamJsonLines<OllamaChatStreamEvent>('/ai/chat/stream', (event) => {
      if (event.type === 'error') {
        throw new OllamaClientError(event.error.trim() || 'The AI API failed during streaming.', 'response');
      }

      replyModel = event.model ?? replyModel;
      if (event.type === 'thinking') {
        thinking = event.snapshot;
      }
      if (event.type === 'content') {
        content = event.snapshot;
      }
      if (event.type === 'tool-calls') {
        toolCalls = event.toolCalls;
      }
      options.onEvent?.(event);
    }, {
      method: 'POST',
      signal: options.signal,
      json: {
        provider: options.provider ?? 'ollama',
        model,
        think: options.think,
        messages,
        tools: options.tools?.length ? options.tools : undefined,
        runtimeOptions: options.runtimeOptions,
      },
    });

    return {
      model: replyModel,
      content: content.trim() || (toolCalls?.length ? '' : 'The selected model returned an empty response.'),
      thinking: thinking.trim() || undefined,
      toolCalls,
    };
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach the AI API.');
  }
}

export async function chatWithModel(
  model: string,
  messages: OllamaChatMessage[],
  options: { provider?: ModelProvider; think?: boolean; tools?: OllamaToolDefinition[]; runtimeOptions?: RuntimeOptions; signal?: AbortSignal } = {},
) {
  return streamChatWithModel(model, messages, options);
}
