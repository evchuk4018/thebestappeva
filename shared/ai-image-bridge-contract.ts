import { AiImageAttachment, parseAiParsedAttachment } from './ai-attachments-contract';

export interface AiImageQueryPayload {
  attachment: AiImageAttachment;
  answer: string;
  question: string;
  model: string;
}

function expectRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}. Expected a string.`);
  }
  return value;
}

export function parseAiImageQueryPayload(value: unknown, field = 'AI image query payload'): AiImageQueryPayload {
  const record = expectRecord(value, field);
  const attachment = parseAiParsedAttachment(record.attachment, `${field}.attachment`);
  if (attachment.kind !== 'image') {
    throw new Error(`Invalid ${field}.attachment. Expected an image attachment.`);
  }

  return {
    attachment,
    answer: expectString(record.answer, `${field}.answer`),
    question: expectString(record.question, `${field}.question`),
    model: expectString(record.model, `${field}.model`),
  };
}
