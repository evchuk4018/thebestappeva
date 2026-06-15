import { serverConfig } from '../config';
import { HttpError } from '../http';
import { createThinkingDeltaParser, normalizeThinkingOutput } from './thinking-parser';
import {
  applyDeepSeekToolCallDeltas,
  finalizeDeepSeekToolCalls,
  readServerSentEvents,
  tryFinalizeDeepSeekToolCalls,
  type DeepSeekToolCallDelta,
} from './stream-parsers';
import type { ProviderChatOptions } from './types';

interface DeepSeekChatMessagePayload {
  content?: string;
  reasoning_content?: string;
  tool_calls?: DeepSeekToolCallDelta[];
}

interface DeepSeekChatResponse {
  model?: string;
  choices?: Array<{ delta?: DeepSeekChatMessagePayload; message?: DeepSeekChatMessagePayload }>;
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

function buildToolResponseMessages(messages: ProviderChatOptions['messages']) {
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

    return { role: message.role, content: message.content };
  });
}

function buildRequestBody(options: ProviderChatOptions, stream: boolean) {
  return {
    model: options.model,
    stream,
    messages: buildToolResponseMessages(options.messages),
    tools: options.tools?.length ? options.tools : undefined,
    max_tokens: options.runtimeOptions?.maxOutputTokens,
    temperature: options.runtimeOptions?.temperature,
    thinking: options.think ? { type: 'enabled' } : undefined,
  };
}

function createResponseAccumulator(options: ProviderChatOptions) {
  const contentParser = createThinkingDeltaParser();
  const pendingToolCalls: DeepSeekToolCallDelta[] = [];
  let replyModel = options.model;
  let content = '';
  let thinking = '';
  let toolCalls: ReturnType<typeof finalizeDeepSeekToolCalls>;
  let toolSignature = '';

  const emitToolCalls = (nextToolCalls: ReturnType<typeof finalizeDeepSeekToolCalls>) => {
    const signature = JSON.stringify(nextToolCalls);
    toolCalls = nextToolCalls;
    if (nextToolCalls?.length && signature !== toolSignature) {
      toolSignature = signature;
      options.onEvent?.({ type: 'tool-calls', toolCalls: nextToolCalls, model: replyModel });
    }
  };

  return {
    setModel(model: string | undefined) {
      replyModel = model ?? replyModel;
    },
    pushMessage(message: DeepSeekChatMessagePayload | undefined, emitStreamingToolCalls: boolean) {
      const reasoningDelta = message?.reasoning_content ?? '';
      if (reasoningDelta) {
        thinking += reasoningDelta;
        options.onEvent?.({ type: 'thinking', delta: reasoningDelta, snapshot: thinking, model: replyModel });
      }

      const contentDelta = message?.content ?? '';
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

      if (!message?.tool_calls?.length) {
        return;
      }

      if (emitStreamingToolCalls) {
        const nextToolCalls = tryFinalizeDeepSeekToolCalls(applyDeepSeekToolCallDeltas(pendingToolCalls, message.tool_calls));
        if (nextToolCalls?.length) {
          emitToolCalls(nextToolCalls);
        }
        return;
      }

      const nextToolCalls = finalizeDeepSeekToolCalls(message.tool_calls);
      if (nextToolCalls?.length) {
        toolCalls = nextToolCalls;
      }
    },
    finish() {
      const remainder = contentParser.finish();
      const normalized = normalizeThinkingOutput(`${content}${remainder.content}`, `${thinking}${remainder.thinking}`);
      const finalToolCalls = pendingToolCalls.length ? finalizeDeepSeekToolCalls(pendingToolCalls) : toolCalls;
      return {
        model: replyModel,
        content: normalized.content || (finalToolCalls?.length ? '' : 'The selected model returned an empty response.'),
        thinking: normalized.thinking || undefined,
        toolCalls: finalToolCalls,
      };
    },
  };
}

export async function requestDeepSeekChat(options: ProviderChatOptions, stream: boolean) {
  const response = await fetch(`${serverConfig.deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serverConfig.deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    signal: options.signal,
    body: JSON.stringify(buildRequestBody(options, stream)),
  });
  const state = createResponseAccumulator(options);

  if (stream) {
    await readServerSentEvents<DeepSeekChatResponse>(response, (chunk) => {
      state.setModel(chunk.model);
      state.pushMessage(chunk.choices?.[0]?.delta, true);
    });
    return state.finish();
  }

  const payload = await readJson<DeepSeekChatResponse>(response, 'Unable to complete the DeepSeek request.');
  state.setModel(payload.model);
  state.pushMessage(payload.choices?.[0]?.message, false);
  return state.finish();
}
