import { AiImageAttachment, parseAiParsedAttachment } from './ai-attachments-contract';
import {
  AiImageComparisonResult,
  AiImageSceneGraph,
  parseAiImageComparisonResult,
  parseAiImageSceneGraph,
} from './ai-image-scene-contract';

export type { AiImageComparisonResult, AiImageSceneGraph } from './ai-image-scene-contract';
export type { AiImageComparisonIssue, AiImageSceneObject } from './ai-image-scene-contract';

export interface AiImageQueryPayload {
  attachment: AiImageAttachment;
  answer: string;
  question: string;
  model: string;
}

export interface AiImageAnalysisPayload {
  attachment: AiImageAttachment;
  sceneGraph: AiImageSceneGraph;
  cached: boolean;
  model: string;
}

export interface AiImageComparePayload {
  attachment: AiImageAttachment;
  comparison: AiImageComparisonResult;
  cached: boolean;
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

function expectBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field}. Expected a boolean.`);
  }
  return value;
}

function parseImageAttachment(value: unknown, field: string) {
  const attachment = parseAiParsedAttachment(value, field);
  if (attachment.kind !== 'image') {
    throw new Error(`Invalid ${field}. Expected an image attachment.`);
  }
  return attachment;
}

export function parseAiImageQueryPayload(value: unknown, field = 'AI image query payload'): AiImageQueryPayload {
  const record = expectRecord(value, field);
  return {
    attachment: parseImageAttachment(record.attachment, `${field}.attachment`),
    answer: expectString(record.answer, `${field}.answer`),
    question: expectString(record.question, `${field}.question`),
    model: expectString(record.model, `${field}.model`),
  };
}

export function parseAiImageAnalysisPayload(value: unknown, field = 'AI image analysis payload'): AiImageAnalysisPayload {
  const record = expectRecord(value, field);
  return {
    attachment: parseImageAttachment(record.attachment, `${field}.attachment`),
    sceneGraph: parseAiImageSceneGraph(record.sceneGraph, `${field}.sceneGraph`),
    cached: expectBoolean(record.cached, `${field}.cached`),
    model: expectString(record.model, `${field}.model`),
  };
}

export function parseAiImageComparePayload(value: unknown, field = 'AI image compare payload'): AiImageComparePayload {
  const record = expectRecord(value, field);
  return {
    attachment: parseImageAttachment(record.attachment, `${field}.attachment`),
    comparison: parseAiImageComparisonResult(record.comparison, `${field}.comparison`),
    cached: expectBoolean(record.cached, `${field}.cached`),
  };
}
