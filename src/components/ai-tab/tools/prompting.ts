import type { OllamaChatMessage, OllamaToolDefinition } from '../ollama-client';
import { loadAiAttachmentContext } from '../../../lib/ai-attachments-storage';
import { buildSystemPromptContent, SystemPromptContext } from '../system-prompt';
import { buildAskUserToolResult } from '../ask-user';
import { AiAttachmentReference, AiMessage, AssistantMessage, ModelProvider } from '../types';
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
  let pendingToolCallId: string | undefined;

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
          id: step.invocation.toolCallId,
          function: {
            name: step.invocation.functionName,
            arguments: step.invocation.args,
          },
        },
      ]);
      pendingToolCallId = step.invocation.toolCallId;
      continue;
    }

    if (step.kind === 'ask-user') {
      if (step.status === 'pending') {
        continue;
      }

      traceMessages.push({
        role: 'tool',
        tool_name: 'ask_user',
        tool_call_id: pendingToolCallId,
        content: formatToolResultContent(buildAskUserToolResult(step)),
      });
      continue;
    }

    traceMessages.push({
      role: 'tool',
      tool_name: step.result.functionName,
      tool_call_id: step.result.toolCallId ?? pendingToolCallId,
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
  if (attachment.kind === 'image') {
    return [
      `Attachment ID: ${attachment.id}`,
      `File: ${attachment.fileName}`,
      `Type: ${attachment.mediaType}`,
      attachment.width || attachment.height ? `Dimensions: ${attachment.width ?? '?'} x ${attachment.height ?? '?'}` : null,
      `Summary model: ${attachment.summaryModel}`,
      `Initial image summary: ${attachment.summary}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `Attachment ID: ${attachment.id}`,
    `File: ${attachment.fileName}`,
    `Title: ${attachment.title}`,
    `Type: ${attachment.mediaType}`,
    `Characters: ${attachment.textChars}`,
    `Chunks: ${attachment.chunkCount}`,
    typeof attachment.pageCount !== 'undefined' ? `Pages: ${attachment.pageCount ?? 'unknown'}` : null,
    attachment.pdfReaderMode ? `PDF handling: ${attachment.pdfReaderMode === 'inline' ? 'full brief PDF loaded' : 'use pdf_reader tools'}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildDeepSeekImageContext(attachment: Extract<AiAttachmentReference, { kind: 'image' }>) {
  return [
    `User uploaded image ${attachment.id}.`,
    '',
    `Initial image summary:`,
    attachment.summary,
    '',
    `You cannot directly see the image. Use ask_image_model to inspect it.`,
    `Call ask_image_model with the imageId and a specific question.`,
    `Examples:`,
    `- Is there a person in the image?`,
    `- What text is visible?`,
    `- Where is the red object?`,
    `- What are the major shapes, colors, and layout?`,
    `Before giving the final answer, ask focused follow-up image questions whenever the summary is not enough.`,
  ].join('\n');
}

function buildPlainImageContext(attachment: Extract<AiAttachmentReference, { kind: 'image' }>) {
  return [`Image attachment:`, formatAttachmentSummary(attachment)].join('\n');
}

async function buildUserMessageContent(
  content: string,
  attachments: AiAttachmentReference[] | undefined,
  provider: ModelProvider,
) {
  const baseContent = content.trim() || 'Use the attached documents as context for this request.';
  if (!attachments?.length) {
    return baseContent;
  }

  const contexts = await Promise.all(
    attachments.map(async (attachment) => {
      if (attachment.kind === 'image') {
        return provider === 'deepseek' ? buildDeepSeekImageContext(attachment) : buildPlainImageContext(attachment);
      }

      const payload = await loadAiAttachmentContext(attachment.id, baseContent);
      return [`Attachment summary:`, formatAttachmentSummary(attachment), '', payload.context].join('\n');
    }),
  );

  return [baseContent, 'Attached file context:', ...contexts].join('\n\n').trim();
}

async function toUserModelMessages(message: AiMessage, provider: ModelProvider) {
  if (message.kind !== 'user') {
    return toModelMessages(message);
  }

  return [
    {
      role: 'user' as const,
      content: await buildUserMessageContent(message.content, message.attachments, provider),
    },
  ] satisfies OllamaChatMessage[];
}

async function toPlainUserModelMessage(message: AiMessage, provider: ModelProvider) {
  if (message.kind !== 'user') {
    return toPlainModelMessage(message);
  }

  return {
    role: 'user' as const,
    content: await buildUserMessageContent(message.content, message.attachments, provider),
  };
}

export async function buildModelMessages(messages: AiMessage[], promptContext: SystemPromptContext, provider: ModelProvider) {
  const normalized = await Promise.all(messages.map((message) => toUserModelMessages(message, provider)));
  return [buildSystemMessage(promptContext), ...normalized.flat()];
}

export async function buildPlainModelMessages(messages: AiMessage[], promptContext: SystemPromptContext, provider: ModelProvider) {
  const normalized = await Promise.all(messages.map((message) => toPlainUserModelMessage(message, provider)));
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
                ...(parameter.schema ?? {
                  type: parameter.type,
                  description: parameter.description,
                }),
              },
            ]),
          ),
          required: toolFunction.parameters.filter((parameter) => parameter.required).map((parameter) => parameter.name),
        },
      },
    })),
  );
}
