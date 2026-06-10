import { serverConfig } from '../config';
import { HttpError } from '../http';
import { createThinkingDeltaParser, normalizeThinkingOutput } from './thinking-parser';
import { applyDeepSeekToolCallDeltas, finalizeDeepSeekToolCalls, readServerSentEvents } from './stream-parsers';
import type { ModelChatMessage } from '../../shared/ai-runtime-contract';
import type { ModelProviderDefinition, ProviderChatOptions } from './types';

function assertConfigured() {
  if (!serverConfig.deepseekApiKey) {
    throw new HttpError(500, 'DeepSeek provider selected but DEEPSEEK_API_KEY is not set.');
  }
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
      return {
        option: {
          value: 'deepseek' as const,
          label: 'DeepSeek',
          configured,
          status: configured ? 'ready' : 'missing-env',
          detail: configured ? 'API key loaded from .env.' : 'DeepSeek API key missing from server environment.',
          defaultModel: serverConfig.deepseekModel,
          defaultModelLabel: serverConfig.deepseekModelLabel,
        },
        models: [{
          name: serverConfig.deepseekModel,
          label: serverConfig.deepseekModelLabel,
          provider: 'deepseek' as const,
          capabilities: [],
        }],
      };
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
