import { Chat, ChatMode, ModelProvider, AiAttachmentReference } from './types';
import { collectImageAttachments } from './tools/image-bridge-tool';
import { collectLongPdfAttachments } from './tools/pdf-reader-tool';

const defaultDocumentPrompt = 'Please analyze the attached documents.';
const defaultImagePrompt = 'Please analyze the attached image and explain what is visible.';
const defaultMixedPrompt = 'Please analyze the attached files and use the image details when they matter.';
const exactImagePattern = /\b(exact|accurate|layout|position|where|coordinate|count|how many|read|text|ocr|label|color|shape|ui|screen|diagram|chart|table|compare|difference|svg|recreate|reconstruct)\b/i;

function latestUserText(chat: Chat) {
  return [...chat.messages].reverse().find((message) => message.kind === 'user')?.content ?? '';
}

function shouldUseStructuredImageAnalysis(chat: Chat) {
  return collectImageAttachments(chat.messages).length > 0 && exactImagePattern.test(latestUserText(chat));
}

export function shouldForceThinkingMode(chat: Chat, provider: ModelProvider) {
  return collectLongPdfAttachments(chat.messages).length > 0 || shouldUseStructuredImageAnalysis(chat);
}

export function resolveTurnMode(chat: Chat, provider: ModelProvider, fallbackMode: ChatMode) {
  return shouldForceThinkingMode(chat, provider) ? 'thinking' : fallbackMode;
}

export function buildDefaultAttachmentPrompt(attachments: AiAttachmentReference[]) {
  const hasImage = attachments.some((attachment) => attachment.kind === 'image');
  const hasDocument = attachments.some((attachment) => attachment.kind === 'document');
  if (hasImage && !hasDocument) {
    return defaultImagePrompt;
  }
  if (hasImage && hasDocument) {
    return defaultMixedPrompt;
  }
  return defaultDocumentPrompt;
}
