import {
  parseAiAttachmentContextPayload,
  parseAiAttachmentHealth,
  parseAiParsedAttachment,
} from '../../shared/ai-attachments-contract';
import {
  parseAiImageDescribePayload,
  type AiImageAnalysisDetail,
  parseAiImageAnalysisPayload,
  parseAiImageComparePayload,
  parseAiImageQueryPayload,
} from '../../shared/ai-image-bridge-contract';
import {
  parseAiPdfPageImagePayload,
  parseAiPdfPagePayload,
  parseAiPdfPagesPayload,
  parseAiPdfSearchPayload,
} from '../../shared/ai-pdf-reader-contract';
import { readJsonTextResponse, requestApi } from './api';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function shouldReadImageDimensions(file: File) {
  return file.type.startsWith('image/');
}

interface AiImageToolRequestOptions {
  signal?: AbortSignal;
  toolCallId?: string;
  requestId?: string;
}

function buildImageRequestHeaders(options: AiImageToolRequestOptions = {}) {
  return {
    ...(options.toolCallId ? { 'x-ai-tool-call-id': options.toolCallId } : {}),
    'x-ai-image-request-id': options.requestId ?? options.toolCallId ?? globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}`,
  };
}

async function readImageDimensions(file: File) {
  if (!shouldReadImageDimensions(file)) {
    return {};
  }

  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      resolve({ width: image.naturalWidth || undefined, height: image.naturalHeight || undefined });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({});
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

export async function parseAiAttachmentFile(file: File) {
  const dimensions = await readImageDimensions(file);
  const response = await requestApi('/ai/attachments/parse', {
    method: 'POST',
    json: {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      base64Data: arrayBufferToBase64(await file.arrayBuffer()),
      ...dimensions,
    },
  });

  return parseAiParsedAttachment(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function loadAiAttachment(attachmentId: string) {
  const response = await requestApi(`/ai/attachments/${attachmentId}`);
  return parseAiParsedAttachment(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function loadAiAttachmentContext(attachmentId: string, query: string) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/context`, { query: { query: query.trim() || undefined } });
  return parseAiAttachmentContextPayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function deleteAiAttachment(attachmentId: string) {
  const response = await requestApi(`/ai/attachments/${attachmentId}`, { method: 'DELETE' });
  await readJsonTextResponse(response, { rejectOkFalse: true });
}

export async function askAiImageQuestion(attachmentId: string, question: string, options: AiImageToolRequestOptions = {}) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/image-query`, {
    method: 'POST',
    headers: buildImageRequestHeaders(options),
    json: { question },
    signal: options.signal,
  });

  return parseAiImageQueryPayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function describeAiImage(attachmentId: string, options: AiImageToolRequestOptions = {}) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/image-describe`, {
    method: 'POST',
    headers: buildImageRequestHeaders(options),
    signal: options.signal,
  });
  return parseAiImageDescribePayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function analyzeAiImage(
  attachmentId: string,
  refresh = false,
  detail: AiImageAnalysisDetail = 'layout',
  options: AiImageToolRequestOptions = {},
) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/image-analysis`, {
    method: 'POST',
    headers: buildImageRequestHeaders(options),
    json: { refresh, detail },
    signal: options.signal,
  });
  return parseAiImageAnalysisPayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function compareAiGeneratedImage(
  attachmentId: string,
  content: string,
  refresh = false,
  iteration?: number,
  maxIterations?: number,
  options: AiImageToolRequestOptions = {},
) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/image-compare`, {
    method: 'POST',
    headers: buildImageRequestHeaders(options),
    json: { format: 'svg', content, refresh, iteration, maxIterations },
    signal: options.signal,
  });
  return parseAiImageComparePayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function loadAiAttachmentHealth() {
  const response = await requestApi('/ai/attachments/health');
  return parseAiAttachmentHealth(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function searchAiPdf(attachmentId: string, query: string, limit = 10) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/pdf/search`, { query: { query, limit } });
  return parseAiPdfSearchPayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function loadAiPdfPage(attachmentId: string, pageNumber: number) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/pdf/pages/${pageNumber}`);
  return parseAiPdfPagePayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function loadAiPdfPages(attachmentId: string, startPage?: number, endPage?: number) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/pdf/pages`, { query: { startPage, endPage } });
  return parseAiPdfPagesPayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}

export async function loadAiPdfPageImage(attachmentId: string, pageNumber: number) {
  const response = await requestApi(`/ai/attachments/${attachmentId}/pdf/pages/${pageNumber}/image`);
  return parseAiPdfPageImagePayload(await readJsonTextResponse(response, { rejectOkFalse: true }));
}
