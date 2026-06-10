import {
  normalizeOllamaError,
  OllamaChatMessage,
  OllamaChatStreamEvent,
  OllamaChatToolCalls,
  OllamaClientError,
  OLLAMA_BASE_URL,
  OllamaToolDefinition,
} from './common';

interface OllamaToolCall {
  function?: {
    name?: string;
    arguments?: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    content?: string;
    thinking?: string;
    tool_calls?: OllamaToolCall[];
  };
}

interface OllamaChatStreamChunk extends OllamaChatResponse {
  done?: boolean;
  error?: string;
}

function parseJsonLine<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new OllamaClientError('Ollama returned invalid JSON.', 'response');
  }
}

function normalizeToolCalls(toolCalls?: OllamaToolCall[]) {
  return toolCalls
    ?.map((toolCall) => {
      const functionName = toolCall.function?.name?.trim();
      if (!functionName) {
        return null;
      }

      return {
        function: {
          name: functionName,
          arguments: toolCall.function?.arguments ?? {},
        },
      };
    })
    .filter(Boolean) as OllamaChatToolCalls | undefined;
}

async function readJsonStream<T>(response: Response, onChunk: (chunk: T) => void) {
  if (!response.ok) {
    const rawBody = (await response.text()).trim();
    if (!rawBody) {
      throw new OllamaClientError(`Ollama request failed with ${response.status}.`, 'response');
    }

    try {
      const payload = JSON.parse(rawBody) as { error?: string };
      throw new OllamaClientError(payload.error?.trim() || `Ollama request failed with ${response.status}.`, 'response');
    } catch {
      throw new OllamaClientError(`Ollama request failed with ${response.status}: ${rawBody}`, 'response');
    }
  }

  if (!response.body) {
    throw new OllamaClientError('Ollama did not return a readable response body.', 'response');
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
      if (!trimmed) {
        continue;
      }

      const chunk = parseJsonLine<T>(trimmed);
      onChunk(chunk);
    }
  }

  if (!buffer.trim()) {
    return;
  }

  const chunk = parseJsonLine<T>(buffer.trim());
  onChunk(chunk);
}

export async function streamChatWithModel(
  model: string,
  messages: OllamaChatMessage[],
  options: { think?: boolean; tools?: OllamaToolDefinition[]; signal?: AbortSignal; onEvent?: (event: OllamaChatStreamEvent) => void } = {},
) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal,
      body: JSON.stringify({
        model,
        stream: true,
        think: options.think,
        messages,
        tools: options.tools?.length ? options.tools : undefined,
      }),
    });

    let replyModel = model;
    let content = '';
    let thinking = '';
    let toolCalls: OllamaChatToolCalls | undefined;
    let toolCallSignature = '';
    await readJsonStream<OllamaChatStreamChunk>(response, (chunk) => {
      if (chunk.error?.trim()) {
        throw new OllamaClientError(chunk.error.trim(), 'response');
      }

      replyModel = chunk.model ?? replyModel;
      const thinkingDelta = chunk.message?.thinking ?? '';
      if (thinkingDelta) {
        thinking += thinkingDelta;
        options.onEvent?.({ type: 'thinking', delta: thinkingDelta, snapshot: thinking, model: replyModel });
      }

      const contentDelta = chunk.message?.content ?? '';
      if (contentDelta) {
        content += contentDelta;
        options.onEvent?.({ type: 'content', delta: contentDelta, snapshot: content, model: replyModel });
      }

      const nextToolCalls = normalizeToolCalls(chunk.message?.tool_calls);
      if (nextToolCalls?.length) {
        const nextSignature = JSON.stringify(nextToolCalls);
        toolCalls = nextToolCalls;
        if (nextSignature !== toolCallSignature) {
          toolCallSignature = nextSignature;
          options.onEvent?.({ type: 'tool-calls', toolCalls: nextToolCalls, model: replyModel });
        }
      }

      if (chunk.done) {
        options.onEvent?.({ type: 'done', model: replyModel });
      }
    });

    const normalizedContent = content.trim();
    const normalizedThinking = thinking.trim();
    return {
      model: replyModel,
      content: normalizedContent || (toolCalls?.length ? '' : 'The selected model returned an empty response.'),
      thinking: normalizedThinking || undefined,
      toolCalls,
    };
  } catch (error) {
    throw normalizeOllamaError(error, 'Unable to reach local Ollama.');
  }
}

export async function chatWithModel(
  model: string,
  messages: OllamaChatMessage[],
  options: { think?: boolean; tools?: OllamaToolDefinition[]; signal?: AbortSignal } = {},
) {
  return streamChatWithModel(model, messages, options);
}
