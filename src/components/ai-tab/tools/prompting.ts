import { OllamaChatMessage, OllamaToolDefinition } from '../ollama-client';
import { loadAiAttachmentContext } from '../../../lib/ai-attachments-storage';
import { buildSystemPromptContent, SystemPromptContext } from '../system-prompt';
import { AiAttachmentReference, AiMessage, AssistantMessage } from '../types';
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
    throw new Error('User messages must be normalized asynchronously before prompt assembly.');
  }

  return buildAssistantTraceMessages(message);
}

function toPlainModelMessage(message: AiMessage): OllamaChatMessage | null {
  if (message.kind === 'user') {
    throw new Error('User messages must be normalized asynchronously before prompt assembly.');
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

function formatAttachmentSummary(attachment: AiAttachmentReference) {
  return [
    `File: ${attachment.fileName}`,
    `Title: ${attachment.title}`,
    `Type: ${attachment.mediaType}`,
    `Characters: ${attachment.textChars}`,
    `Chunks: ${attachment.chunkCount}`,
  ].join('\n');
}

async function buildUserMessageContent(content: string, attachments: AiAttachmentReference[] | undefined) {
  const baseContent = content.trim() || 'Use the attached documents as context for this request.';
  if (!attachments?.length) {
    return baseContent;
  }

  const contexts = await Promise.all(
    attachments.map(async (attachment) => {
      const payload = await loadAiAttachmentContext(attachment.id, baseContent);
      return [`Attachment summary:`, formatAttachmentSummary(attachment), '', payload.context].join('\n');
    }),
  );

  return [baseContent, 'Attached document context:', ...contexts].join('\n\n').trim();
}

async function toUserModelMessages(message: AiMessage) {
  if (message.kind !== 'user') {
    return toModelMessages(message);
  }

  return [
    {
      role: 'user' as const,
      content: await buildUserMessageContent(message.content, message.attachments),
    },
  ] satisfies OllamaChatMessage[];
}

async function toPlainUserModelMessage(message: AiMessage) {
  if (message.kind !== 'user') {
    return toPlainModelMessage(message);
  }

  return {
    role: 'user' as const,
    content: await buildUserMessageContent(message.content, message.attachments),
  };
}

export async function buildModelMessages(messages: AiMessage[], promptContext: SystemPromptContext) {
  const normalized = await Promise.all(messages.map((message) => toUserModelMessages(message)));
  return [buildSystemMessage(promptContext), ...normalized.flat()];
}

export async function buildPlainModelMessages(messages: AiMessage[], promptContext: SystemPromptContext) {
  const normalized = await Promise.all(messages.map((message) => toPlainUserModelMessage(message)));
  return [buildSystemMessage(promptContext), ...(normalized.filter(Boolean) as OllamaChatMessage[])];
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
