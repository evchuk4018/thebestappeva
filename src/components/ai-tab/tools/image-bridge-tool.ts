import { analyzeAiImage, askAiImageQuestion, compareAiGeneratedImage, describeAiImage } from '../../../lib/ai-attachments-storage';
import type { AiImageAnalysisDetail } from '../../../../shared/ai-image-bridge-contract';
import { AiAttachmentReference, AiMessage } from '../types';
import { ToolRegistryEntry } from './types';

function isImageAttachment(attachment: AiAttachmentReference): attachment is Extract<AiAttachmentReference, { kind: 'image' }> {
  return attachment.kind === 'image';
}

function requireString(value: unknown, name: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`image-bridge requires a non-empty \`${name}\` argument.`);
  }
  return value.trim();
}

function requireBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function requireDetail(value: unknown): AiImageAnalysisDetail {
  return value === 'semantic' ? 'semantic' : 'layout';
}

function requireNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

export function createImageBridgeTool(attachments: Extract<AiAttachmentReference, { kind: 'image' }>[], maxVisionCallsPerMessage = 4): ToolRegistryEntry {
  let visionCallCount = 0;

  function consumeVisionCall(functionName: string) {
    if (visionCallCount >= maxVisionCallsPerMessage) {
      throw new Error(`${functionName} exceeded the per-message vision call limit of ${maxVisionCallsPerMessage}.`);
    }
    visionCallCount += 1;
  }

  return {
    definition: {
      id: 'image-bridge',
      label: 'Image Bridge',
      alias: '/image-bridge',
      description: 'Describes uploaded images, answers follow-up image questions, builds structured scene graphs, and compares generated SVG output against the source.',
      enabledByDefault: false,
      automatic: true,
      functions: [
        {
          name: 'describe_image',
          description: 'Describe one uploaded image using the active vision mode.',
          parameters: [
            { name: 'imageId', type: 'string', description: 'Image attachment ID, such as image_abc123.', required: true },
          ],
        },
        {
          name: 'ask_image_model',
          description: 'Ask a targeted follow-up question about one uploaded image using the active vision mode.',
          parameters: [
            { name: 'imageId', type: 'string', description: 'Image attachment ID, such as image_abc123.', required: true },
            { name: 'question', type: 'string', description: 'A specific question about the image.', required: true },
          ],
        },
        {
          name: 'extract_image_scene',
          description: 'Extract a structured scene graph for one uploaded image.',
          parameters: [
            { name: 'imageId', type: 'string', description: 'Image attachment ID, such as image_abc123.', required: true },
            { name: 'refresh', type: 'boolean', description: 'Recompute the scene graph instead of reusing cached analysis.' },
            { name: 'detail', type: 'string', description: 'Use "layout" for fast exact evidence or "semantic" for optional model labels.' },
          ],
        },
        {
          name: 'compare_generated_image',
          description: 'Render generated SVG content and compare it to the source image using scene graphs and OCR.',
          parameters: [
            { name: 'imageId', type: 'string', description: 'Image attachment ID, such as image_abc123.', required: true },
            { name: 'content', type: 'string', description: 'Generated SVG markup to render and compare.', required: true },
            { name: 'refresh', type: 'boolean', description: 'Refresh the cached source scene graph before comparing.' },
            { name: 'iteration', type: 'number', description: 'Current repair-loop iteration number.' },
            { name: 'maxIterations', type: 'number', description: 'Maximum repair-loop iterations allowed.' },
          ],
        },
      ],
    },
    async execute(invocation) {
      const attachment = requireImageAttachment(attachments, invocation.args.imageId);
      if (invocation.functionName === 'describe_image') {
        consumeVisionCall(invocation.functionName);
        const payload = await describeAiImage(attachment.id);
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: payload.metadata.notice ?? `Described ${attachment.id} with ${payload.metadata.provider}.`,
          data: {
            imageId: attachment.id,
            summary: payload.summary,
            metadata: payload.metadata,
          },
        };
      }

      if (invocation.functionName === 'ask_image_model') {
        consumeVisionCall(invocation.functionName);
        const payload = await askAiImageQuestion(attachment.id, requireString(invocation.args.question, 'question'));
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: payload.metadata.notice ?? `Answered a follow-up image question with ${payload.metadata.provider}.`,
          data: {
            imageId: attachment.id,
            question: payload.question,
            answer: payload.answer,
            metadata: payload.metadata,
          },
        };
      }

      if (invocation.functionName === 'extract_image_scene') {
        const payload = await analyzeAiImage(
          attachment.id,
          requireBoolean(invocation.args.refresh),
          requireDetail(invocation.args.detail),
        );
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Extracted a structured scene graph for ${attachment.id}.`,
          data: {
            imageId: attachment.id,
            model: payload.model,
            cached: payload.cached,
            detail: payload.detail,
            sceneGraph: payload.sceneGraph,
          },
        };
      }

      const payload = await compareAiGeneratedImage(
        attachment.id,
        requireString(invocation.args.content, 'content'),
        requireBoolean(invocation.args.refresh),
        requireNumber(invocation.args.iteration),
        requireNumber(invocation.args.maxIterations),
      );
      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary: `Compared generated SVG output against ${attachment.id}.`,
        data: {
          imageId: attachment.id,
          cached: payload.cached,
          comparison: payload.comparison,
        },
      };
    },
  };
}
