import { normalizeOllamaError, OllamaClientError } from './common';
import type { OllamaChatMessage, OllamaChatStreamEvent, OllamaChatToolCalls, OllamaToolDefinition } from './common';
import type { ModelProvider } from '../../../shared/ai-runtime-contract';
import type { RuntimeOptions } from './common';

function parseJsonLine<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new OllamaClientError('The local AI server returned invalid JSON.', 'response');
  }
}

async function readJsonStream<T>(response: Response, onChunk: (chunk: T) => void) {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new OllamaClientError(payload?.error?.trim() || `The local AI server failed with ${response.status}.`, 'response');
  }

  if (!response.body) {
    throw new OllamaClientError('The local AI server did not return a readable response body.', 'response');
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
        onChunk(parseJsonLine<T>(trimmed));
      }
    }
  }

  if (buffer.trim()) {
    onChunk(parseJsonLine<T>(buffer.trim()));
  }
}

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
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        provider: options.provider ?? 'ollama',
        model,
        think: options.think,
        messages,
        tools: options.tools?.length ? options.tools : undefined,
        runtimeOptions: options.runtimeOptions,
      }),
    });

    let replyModel = model;
    let content = '';
    let thinking = '';
    let toolCalls: OllamaChatToolCalls | undefined;

    await readJsonStream<OllamaChatStreamEvent>(response, (event) => {
      if (event.type === 'error') {
        throw new OllamaClientError(event.error.trim() || 'The local AI server failed during streaming.', 'response');
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
    });

    return {
      model: replyModel,
      content: content.trim() || (toolCalls?.length ? '' : 'The selected model returned an empty response.'),
      thinking: thinking.trim() || undefined,
      toolCalls,
    };
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach the local AI server.');
  }
}

export async function chatWithModel(
  model: string,
  messages: OllamaChatMessage[],
  options: { provider?: ModelProvider; think?: boolean; tools?: OllamaToolDefinition[]; runtimeOptions?: RuntimeOptions; signal?: AbortSignal } = {},
) {
  return streamChatWithModel(model, messages, options);
}
