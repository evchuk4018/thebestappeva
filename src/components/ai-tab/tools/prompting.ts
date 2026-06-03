import { AiMessage, ModelMessage } from '../types';
import { ToolRegistryEntry } from './types';

function formatValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function buildToolManifest(entries: ToolRegistryEntry[]) {
  if (entries.length === 0) {
    return 'No tools are enabled for this chat. Answer normally and do not emit tool calls.';
  }

  return entries
    .map((entry) => {
      const functions = entry.definition.functions
        .map((toolFunction) => {
          const parameters = toolFunction.parameters
            .map((parameter) => `${parameter.name}: ${parameter.type}${parameter.required ? ' required' : ''} - ${parameter.description}`)
            .join('; ');

          return `- ${toolFunction.name}: ${toolFunction.description}${parameters ? ` Params: ${parameters}.` : ''}`;
        })
        .join('\n');

      return `${entry.definition.id} (${entry.definition.alias}): ${entry.definition.description}\n${functions}`;
    })
    .join('\n\n');
}

export function buildToolSystemPrompt(entries: ToolRegistryEntry[]) {
  return [
    'You are a local AI assistant running inside a browser app.',
    'If you need a tool, respond with ONLY a single XML-wrapped JSON payload and no prose.',
    'Exact format: <tool_call>{"tool":"weather","function":"get_current_weather","arguments":{"query":"Boston, MA"}}</tool_call>',
    'Do not wrap the tool call in markdown fences.',
    'If the user has not given enough information to satisfy required tool arguments, ask a follow-up question instead of guessing.',
    'After the app sends a tool result message, use it to answer naturally.',
    buildToolManifest(entries),
  ].join('\n\n');
}

function toModelMessage(message: AiMessage): ModelMessage {
  if (message.kind === 'user') {
    return { role: 'user', content: message.content };
  }

  if (message.kind === 'assistant') {
    return { role: 'assistant', content: message.content };
  }

  if (message.kind === 'tool-call') {
    return {
      role: 'assistant',
      content: `<tool_call>${JSON.stringify({
        tool: message.invocation.toolId,
        function: message.invocation.functionName,
        arguments: message.invocation.args,
      })}</tool_call>`,
    };
  }

  return {
    role: 'user',
    content: [
      'TOOL RESULT',
      `tool: ${message.result.toolId}`,
      `function: ${message.result.functionName}`,
      `ok: ${message.result.ok}`,
      `summary: ${message.result.summary}`,
      `data: ${formatValue(message.result.data ?? null)}`,
      `error: ${message.result.error ?? 'none'}`,
    ].join('\n'),
  };
}

export function buildModelMessages(messages: AiMessage[], entries: ToolRegistryEntry[]) {
  return [
    { role: 'system', content: buildToolSystemPrompt(entries) } satisfies ModelMessage,
    ...messages.map(toModelMessage),
  ];
}
