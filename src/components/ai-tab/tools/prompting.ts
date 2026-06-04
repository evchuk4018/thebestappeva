import { OllamaChatMessage, OllamaToolDefinition } from '../ollama-client';
import { AiMessage, AssistantMessage } from '../types';
import { ToolRegistryEntry } from './types';

const FORMATTING_SYSTEM_PROMPT = [
  'You may use rich Markdown in assistant replies when it improves clarity.',
  'Supported output includes headings, bold, italics, ordered and unordered lists, links, blockquotes, fenced code blocks, tables, task lists, and horizontal rules.',
  'Use inline math with $...$ when mathematical notation is helpful.',
  'For display math, put $$ on separate lines before and after the equation block.',
  'Do not use raw HTML unless the user explicitly asks for HTML.',
  'Do not wrap the entire reply in a single code fence.',
].join('\n');

function buildFormattingSystemMessage(): OllamaChatMessage {
  return {
    role: 'system',
    content: FORMATTING_SYSTEM_PROMPT,
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

export function buildModelMessages(messages: AiMessage[]) {
  return [buildFormattingSystemMessage(), ...messages.flatMap(toModelMessages)];
}

export function buildPlainModelMessages(messages: AiMessage[]) {
  return [buildFormattingSystemMessage(), ...(messages.map(toPlainModelMessage).filter(Boolean) as OllamaChatMessage[])];
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
