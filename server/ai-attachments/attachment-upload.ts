import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Request } from 'express';
import { AiAttachmentHealth, AiDocumentAttachment, AiImageAttachment } from '../../shared/ai-attachments-contract';
import { serverConfig } from '../config';
import { HttpError } from '../http';
import { buildAttachmentChunks } from './chunking';
import { classifyPdfReaderMode } from './pdf-content';
import { parseDocumentWithDocling, readParserHealth } from './parser';
import { saveAttachmentRecord, saveAttachmentSource } from './storage';
import { StoredAiAttachmentRecord } from './types';
import { generateImageSummary } from './vision-model';

interface ParseAttachmentRequestBody {
  base64Data?: string;
  contentType?: string;
  fileName?: string;
  width?: number;
  height?: number;
}

const supportedDocumentExtensions = new Set(['.pdf', '.docx', '.xlsx']);
const supportedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function createImageId() {
  return `image_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function readParseBody(request: Request) {
  const body = request.body as ParseAttachmentRequestBody | null;
  if (!body?.fileName || !body.base64Data) {
    throw new HttpError(400, 'Attachment parsing requires fileName and base64Data.');
  }

  return {
    fileName: body.fileName.trim(),
    mediaType: body.contentType?.trim() || 'application/octet-stream',
    fileBuffer: Buffer.from(body.base64Data, 'base64'),
    base64Data: body.base64Data,
    width: typeof body.width === 'number' && Number.isFinite(body.width) ? body.width : undefined,
    height: typeof body.height === 'number' && Number.isFinite(body.height) ? body.height : undefined,
  };
}

function validateUpload(fileName: string, mediaType: string, fileBuffer: Buffer) {
  const extension = path.extname(fileName).toLowerCase();
  if (!fileBuffer.length || fileBuffer.length > serverConfig.aiAttachmentMaxUploadBytes) {
    throw new HttpError(413, `Attachments must be between 1 byte and ${serverConfig.aiAttachmentMaxUploadBytes} bytes.`);
  }

  if (supportedDocumentExtensions.has(extension)) {
    return { extension, kind: 'document' as const };
  }
  if (supportedImageMimeTypes.has(mediaType)) {
    return { extension: extension || defaultImageExtension(mediaType), kind: 'image' as const };
  }

  throw new HttpError(415, 'Only .pdf, .docx, .xlsx, PNG, JPEG, WebP, and GIF files are supported in this version.');
}

function defaultImageExtension(mediaType: string) {
  switch (mediaType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.png';
  }
}

function toHealthPayload(health: Awaited<ReturnType<typeof readParserHealth>>): AiAttachmentHealth {
  return {
    available: health.available,
    parser: 'docling',
    message: health.message,
    details: health.details,
  };
}

function buildStoredDocumentRecord(args: {
  id: string;
  extension: string;
  fileBuffer: Buffer;
  fileName: string;
  mediaType: string;
  parsed: Awaited<ReturnType<typeof parseDocumentWithDocling>>;
}): StoredAiAttachmentRecord {
  const createdAt = new Date().toISOString();
  const { chunks, outline } = buildAttachmentChunks(args.parsed.markdown || args.parsed.text);
  const pageCount = args.parsed.stats.pageCount;
  const attachment: AiDocumentAttachment = {
    id: args.id,
    kind: 'document',
    createdAt,
    fileName: args.fileName,
    mediaType: args.mediaType,
    fileSize: args.fileBuffer.length,
    parser: 'docling',
    title: args.parsed.title || args.fileName.replace(/\.[^.]+$/, ''),
    textChars: args.parsed.text.length,
    chunkCount: chunks.length,
    warningCount: args.parsed.warnings.length,
    pageCount: args.extension === '.pdf' ? pageCount : undefined,
    pdfReaderMode: args.extension === '.pdf' ? classifyPdfReaderMode(pageCount) : undefined,
    outline,
    warnings: args.parsed.warnings,
    stats: args.parsed.stats,
    previewText: args.parsed.text.slice(0, 400),
  };

  return {
    attachment,
    markdown: args.parsed.markdown,
    text: args.parsed.text,
    chunks,
    pages: args.parsed.pages,
    sourceExtension: args.extension,
  };
}

async function buildStoredImageRecord(args: {
  id: string;
  extension: string;
  fileBuffer: Buffer;
  fileName: string;
  mediaType: string;
  base64Data: string;
  width?: number;
  height?: number;
}) {
  const createdAt = new Date().toISOString();
  const { model, summary } = await generateImageSummary(args.base64Data);
  const attachment: AiImageAttachment = {
    id: args.id,
    kind: 'image',
    createdAt,
    fileName: args.fileName,
    mediaType: args.mediaType,
    fileSize: args.fileBuffer.length,
    width: args.width,
    height: args.height,
    summary,
    summaryModel: model,
    summaryStatus: 'ready',
    analysisStatus: 'idle',
  };

  return {
    attachment,
    sourceExtension: args.extension,
  } satisfies StoredAiAttachmentRecord;
}

export async function parseIncomingAttachment(request: Request) {
  const parsedBody = readParseBody(request);
  const upload = validateUpload(parsedBody.fileName, parsedBody.mediaType, parsedBody.fileBuffer);
  if (upload.kind === 'image') {
    const id = createImageId();
    const sourcePath = await saveAttachmentSource(id, upload.extension, parsedBody.fileBuffer);
    try {
      const record = await buildStoredImageRecord({ ...parsedBody, id, extension: upload.extension });
      await saveAttachmentRecord(record);
      return record;
    } catch (error) {
      await fs.unlink(sourcePath).catch(() => undefined);
      throw error;
    }
  }

  const id = randomUUID();
  const sourcePath = await saveAttachmentSource(id, upload.extension, parsedBody.fileBuffer);
  try {
    const parsed = await parseDocumentWithDocling(sourcePath);
    const record = buildStoredDocumentRecord({
      id,
      extension: upload.extension,
      fileBuffer: parsedBody.fileBuffer,
      fileName: parsedBody.fileName,
      mediaType: parsedBody.mediaType,
      parsed,
    });
    await saveAttachmentRecord(record);
    return record;
  } catch (error) {
    await fs.unlink(sourcePath).catch(() => undefined);
    throw error;
  }
}

export async function readAttachmentHealth() {
  try {
    return await readParserHealth();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The local Docling parser is unavailable.';
    return {
      available: false,
      parser: 'docling' as const,
      message: 'The local Docling parser is unavailable.',
      details: message,
    };
  }
}

export { toHealthPayload };
