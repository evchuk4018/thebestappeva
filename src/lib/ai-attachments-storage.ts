import {
  parseAiAttachmentContextPayload,
  parseAiAttachmentHealth,
  parseAiParsedAttachment,
} from '../../shared/ai-attachments-contract';
import {
  parseAiPdfPageImagePayload,
  parseAiPdfPagePayload,
  parseAiPdfSearchPayload,
} from '../../shared/ai-pdf-reader-contract';

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({ ok: false, error: 'The local server returned invalid JSON.' }));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `The local server failed with ${response.status}.`;
    throw new Error(message);
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

export async function parseAiAttachmentFile(file: File) {
  const response = await fetch('/api/ai/attachments/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      base64Data: arrayBufferToBase64(await file.arrayBuffer()),
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

export async function loadAiPdfPageImage(attachmentId: string, pageNumber: number) {
  const response = await fetch(`/api/ai/attachments/${attachmentId}/pdf/pages/${pageNumber}/image`);
  return parseAiPdfPageImagePayload(await readJsonResponse(response));
}
