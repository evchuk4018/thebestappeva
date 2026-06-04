import { OllamaChatMessage, OllamaToolDefinition } from '../ollama-client';
import { buildSystemPromptContent, SystemPromptContext } from '../system-prompt';
import { AiMessage, AssistantMessage } from '../types';
import { ToolRegistryEntry } from './types';

function buildSystemMessage(promptContext: SystemPromptContext): OllamaChatMessage {
  return {
    role: 'system',
    content: buildSystemPromptContent(promptContext),
  };
}

function buildAssistantTraceMessages(message: AssistantMessage) {
  const traceMessages: OllamaChatMessage[] = [];
  let pendingThinking: string[] = [];

  const flushPendingAssistant = (content: string, toolCalls?: OllamaChatMessage['tool_calls']) => {
    const combinedThinking = pendingThinking.join('\n\n').trim();
    traceMessages.push({
      role: 'assistant',
      content,
      thinking: combinedThinking || undefined,
      tool_calls: toolCalls,
    });
    pendingThinking = [];
  };

  for (const step of message.trace ?? []) {
    if (step.kind === 'thinking') {
      pendingThinking.push(step.content);
      continue;
    }

    if (step.kind === 'tool-call') {
      flushPendingAssistant('', [
        {
          function: {
            name: step.invocation.functionName,
            arguments: step.invocation.args,
          },
        },
      ]);
      continue;
    }

    traceMessages.push({
      role: 'tool',
      tool_name: step.result.functionName,
      content: formatToolResultContent(step.result),
    });
  }

  if (message.content.trim() || pendingThinking.length) {
    flushPendingAssistant(message.content);
  }

  return traceMessages;
}

function toModelMessages(message: AiMessage) {
  if (message.kind === 'user') {
    return [{ role: 'user', content: message.content }] satisfies OllamaChatMessage[];
  }

  return buildAssistantTraceMessages(message);
}

function toPlainModelMessage(message: AiMessage): OllamaChatMessage | null {
  if (message.kind === 'user') {
    return { role: 'user', content: message.content };
  }

  if (message.kind === 'assistant') {
    return { role: 'assistant', content: message.content };
  }

  return null;
}

export function formatToolResultContent(result: {
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
}) {
  return JSON.stringify(
    {
      ok: result.ok,
      summary: result.summary,
      data: result.data ?? null,
      error: result.error ?? null,
    },
    null,
    2,
  );
}

export function buildModelMessages(messages: AiMessage[], promptContext: SystemPromptContext) {
  return [buildSystemMessage(promptContext), ...messages.flatMap(toModelMessages)];
}

export function buildPlainModelMessages(messages: AiMessage[], promptContext: SystemPromptContext) {
  return [buildSystemMessage(promptContext), ...(messages.map(toPlainModelMessage).filter(Boolean) as OllamaChatMessage[])];
}

export function buildOllamaTools(entries: ToolRegistryEntry[]): OllamaToolDefinition[] {
  return entries.flatMap((entry) =>
    entry.definition.functions.map((toolFunction) => ({
      type: 'function' as const,
      function: {
        name: toolFunction.name,
        description: toolFunction.description,
        parameters: {
          type: 'object' as const,
          properties: Object.fromEntries(
            toolFunction.parameters.map((parameter) => [
              parameter.name,
              {
                type: parameter.type,
                description: parameter.description,
              },
            ]),
          ),
          required: toolFunction.parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name),
        },
      },
    })),
  );
}
