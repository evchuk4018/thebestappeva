import { HttpError } from '../http';
import { ModelChatToolCalls } from '../../shared/ai-runtime-contract';

interface DeepSeekToolCallDelta {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

function parseJson<T>(value: string, fallback: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new HttpError(502, fallback);
  }
}

export async function readNdjsonStream<T>(response: Response, onChunk: (chunk: T) => void) {
  if (!response.ok) {
    const message = (await response.text()).trim() || `The upstream runtime failed with ${response.status}.`;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }

  if (!response.body) {
    throw new HttpError(502, 'The upstream runtime did not return a readable response body.');
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
        onChunk(parseJson<T>(trimmed, 'The upstream runtime returned invalid NDJSON.'));
      }
    }
  }

  if (buffer.trim()) {
    onChunk(parseJson<T>(buffer.trim(), 'The upstream runtime returned invalid NDJSON.'));
  }
}

export async function readServerSentEvents<T>(response: Response, onChunk: (chunk: T) => void) {
  if (!response.ok) {
    const rawBody = (await response.text()).trim();
    const message = rawBody
      ? (() => {
          try {
            const payload = JSON.parse(rawBody) as { error?: { message?: string }; message?: string };
            return payload.error?.message?.trim() || payload.message?.trim() || rawBody;
          } catch {
            return rawBody;
          }
        })()
      : `The upstream runtime failed with ${response.status}.`;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }

  if (!response.body) {
    throw new HttpError(502, 'The upstream runtime did not return a readable event stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventLines: string[] = [];

  const flushEvent = () => {
    if (!eventLines.length) {
      return;
    }

    const data = eventLines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    eventLines = [];
    if (!data || data === '[DONE]') {
      return;
    }

    onChunk(parseJson<T>(data, 'The upstream runtime returned invalid event JSON.'));
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) {
        flushEvent();
        continue;
      }
      eventLines.push(line);
    }
  }

  if (buffer.trim()) {
    eventLines.push(buffer.trim());
  }
  flushEvent();
}

export function normalizeToolCalls(toolCalls?: Array<{ function?: { name?: string; arguments?: Record<string, unknown> }; id?: string }>) {
  return toolCalls
    ?.map((toolCall) => {
      const functionName = toolCall.function?.name?.trim();
      if (!functionName) {
        return null;
      }

      return {
        id: toolCall.id?.trim() || undefined,
        function: {
          name: functionName,
          arguments: toolCall.function?.arguments ?? {},
        },
      };
    })
    .filter(Boolean) as ModelChatToolCalls | undefined;
}

export function applyDeepSeekToolCallDeltas(current: DeepSeekToolCallDelta[], delta: DeepSeekToolCallDelta[]) {
  for (const item of delta) {
    const index = typeof item.index === 'number' ? item.index : current.length;
    const target = current[index] ?? { function: { arguments: '' } };
    current[index] = {
      id: item.id ?? target.id,
      index,
      function: {
        name: item.function?.name ?? target.function?.name,
        arguments: `${target.function?.arguments ?? ''}${item.function?.arguments ?? ''}`,
      },
    };
  }

  return current;
}

export function finalizeDeepSeekToolCalls(toolCalls: DeepSeekToolCallDelta[]) {
  return normalizeToolCalls(
    toolCalls.map((toolCall) => ({
      id: toolCall.id,
      function: {
        name: toolCall.function?.name,
        arguments: toolCall.function?.arguments?.trim()
          ? parseJson<Record<string, unknown>>(toolCall.function.arguments, 'DeepSeek returned invalid tool arguments.')
          : {},
      },
    })),
  );
}
