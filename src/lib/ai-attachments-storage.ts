import {
  parseAiAttachmentContextPayload,
  parseAiAttachmentHealth,
  parseAiParsedAttachment,
} from '../../shared/ai-attachments-contract';
import {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildInvalidApiResponseMessage(rawBody: string) {
  const detail = /^\s*</.test(rawBody) ? 'HTML instead of JSON' : 'an invalid JSON response';
  return `The local API returned ${detail}. Restart the development server so its routes match the loaded app.`;
}

async function readJsonResponse(response: Response) {
  const rawBody = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error(buildInvalidApiResponseMessage(rawBody));
  }

  const error = isRecord(payload) && typeof payload.error === 'string' ? payload.error.trim() : '';
  if (!response.ok) {
    throw new Error(error || `The local server failed with ${response.status}.`);
  }

  if (isRecord(payload) && payload.ok === false) {
    throw new Error(error || 'The local API reported an unsuccessful response.');
  }

  return payload;
}

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
  const response = await fetch('/api/ai/attachments/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      base64Data: arrayBufferToBase64(await file.arrayBuffer()),
      ...dimensions,
    }),
  });

  return parseAiParsedAttachment(await readJsonResponse(response));
}

export async function loadAiAttachment(attachmentId: string) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}`);
  return parseAiParsedAttachment(await readJsonResponse(response));
}

export async function loadAiAttachmentContext(attachmentId: string, query: string) {
  const url = new URL(`/api/ai/attachments/${attachmentId}/context`, window.location.origin);
  if (query.trim()) {
    url.searchParams.set('query', query.trim());
  }

  const response = await fetch(url);
  return parseAiAttachmentContextPayload(await readJsonResponse(response));
}

export async function deleteAiAttachment(attachmentId: string) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}`, { method: 'DELETE' });
  await readJsonResponse(response);
}

export async function askAiImageQuestion(attachmentId: string, question: string) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}/image-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  return parseAiImageQueryPayload(await readJsonResponse(response));
}

export async function analyzeAiImage(attachmentId: string, refresh = false) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}/image-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  return parseAiImageAnalysisPayload(await readJsonResponse(response));
}

export async function compareAiGeneratedImage(
  attachmentId: string,
  content: string,
  refresh = false,
  iteration?: number,
  maxIterations?: number,
) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}/image-compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format: 'svg', content, refresh, iteration, maxIterations }),
  });
  return parseAiImageComparePayload(await readJsonResponse(response));
}

export async function loadAiAttachmentHealth() {
  const response = await fetch('/api/ai/attachments/health');
  return parseAiAttachmentHealth(await readJsonResponse(response));
}

export async function searchAiPdf(attachmentId: string, query: string, limit = 10) {
  const url = new URL(`/api/ai/attachments/${attachmentId}/pdf/search`, window.location.origin);
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url);
  return parseAiPdfSearchPayload(await readJsonResponse(response));
}

export async function loadAiPdfPage(attachmentId: string, pageNumber: number) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}/pdf/pages/${pageNumber}`);
  return parseAiPdfPagePayload(await readJsonResponse(response));
}

export async function loadAiPdfPages(attachmentId: string, startPage?: number, endPage?: number) {
  const url = new URL(`/api/ai/attachments/${attachmentId}/pdf/pages`, window.location.origin);
  if (typeof startPage === 'number') {
    url.searchParams.set('startPage', String(startPage));
  }
  if (typeof endPage === 'number') {
    url.searchParams.set('endPage', String(endPage));
  }

  const response = await fetch(url);
  return parseAiPdfPagesPayload(await readJsonResponse(response));
}

export async function loadAiPdfPageImage(attachmentId: string, pageNumber: number) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}/pdf/pages/${pageNumber}/image`);
  return parseAiPdfPageImagePayload(await readJsonResponse(response));
}
