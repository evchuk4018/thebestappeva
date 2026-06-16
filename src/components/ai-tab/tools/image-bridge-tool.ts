import { askAiImageQuestion } from '../../../lib/ai-attachments-storage';
import { AiAttachmentReference, AiMessage } from '../types';
import { ToolRegistryEntry } from './types';

function isImageAttachment(attachment: AiAttachmentReference): attachment is Extract<AiAttachmentReference, { kind: 'image' }> {
  return attachment.kind === 'image';
}

function requireString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`ask_image_model requires a non-empty \`${name}\` argument.`);
  }
  return value.trim();
}

function requireImageAttachment(attachments: Extract<AiAttachmentReference, { kind: 'image' }>[], imageId: unknown) {
  const id = requireString(imageId, 'imageId');
  const attachment = attachments.find((candidate) => candidate.id === id);
  if (!attachment) {
    throw new Error(`Image "${id}" is not available in this chat.`);
  }
  return attachment;
}

export function collectImageAttachments(messages: AiMessage[]) {
  const attachments = messages.flatMap((message) => (message.kind === 'user' ? message.attachments ?? [] : []));
  return [...new Map(attachments.filter(isImageAttachment).map((attachment) => [attachment.id, attachment])).values()];
}

export function createImageBridgeTool(attachments: Extract<AiAttachmentReference, { kind: 'image' }>[]): ToolRegistryEntry {
  return {
    definition: {
      id: 'image-bridge',
      label: 'Image Bridge',
      alias: '/image-bridge',
      description: 'Inspects uploaded images through a local vision model when the active model cannot see them directly.',
      enabledByDefault: false,
      automatic: true,
      functions: [
        {
          name: 'ask_image_model',
          description: 'Ask a focused visual question about one uploaded image by its imageId.',
          parameters: [
            { name: 'imageId', type: 'string', description: 'Image attachment ID, such as image_abc123.', required: true },
            { name: 'question', type: 'string', description: 'Specific visual question to answer from the image.', required: true },
          ],
        },
      ],
    },
    async execute(invocation) {
      const attachment = requireImageAttachment(attachments, invocation.args.imageId);
      const question = requireString(invocation.args.question, 'question');
      const payload = await askAiImageQuestion(attachment.id, question);
      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary: `Answered image question for ${attachment.id}.`,
        data: {
          imageId: attachment.id,
          question,
          answer: payload.answer,
          model: payload.model,
        },
      };
    },
  };
}
