import { OllamaChatMessage, OllamaToolDefinition } from '../ollama-client';
import { AiMessage } from '../types';
import { ToolRegistryEntry } from './types';

function toModelMessage(message: AiMessage): OllamaChatMessage | null {
  if (message.kind === 'user') {
    return { role: 'user', content: message.content };
  }

  if (message.kind === 'assistant') {
    return {
      role: 'assistant',
      content: message.content,
      thinking: message.thinking,
    };
  }

  if (message.kind === 'tool-call') {
    return {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          function: {
            name: message.invocation.functionName,
            arguments: message.invocation.args,
          },
        },
      ],
    };
  }

  return {
    role: 'tool',
    tool_name: message.result.functionName,
    content: formatToolResultContent(message.result),
  };
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

export function buildModelMessages(messages: AiMessage[]) {
  return messages.map(toModelMessage).filter(Boolean) as OllamaChatMessage[];
}

export function buildPlainModelMessages(messages: AiMessage[]) {
  return messages.map(toPlainModelMessage).filter(Boolean) as OllamaChatMessage[];
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
