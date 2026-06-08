import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Request, Response } from 'express';
import { AiAttachmentHealth, AiParsedAttachment } from '../../shared/ai-attachments-contract';
import { serverConfig } from '../config';
import { HttpError, getOptionalQueryParam, getRequiredQueryParam, toErrorMessage } from '../http';
import { buildAttachmentChunks, buildAttachmentContext } from './chunking';
import { classifyPdfReaderMode } from './pdf-content';
import { getPdfReaderMode } from './pdf-record';
import { parseDocumentWithDocling, readParserHealth } from './parser';
import { deleteAttachmentRecord, readAttachmentRecord, saveAttachmentRecord, saveAttachmentSource, toParsedAttachment } from './storage';
import { StoredAiAttachmentRecord } from './types';

interface ParseAttachmentRequestBody {
  base64Data?: string;
  contentType?: string;
  fileName?: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx']);

function toHealthPayload(health: Awaited<ReturnType<typeof readParserHealth>>): AiAttachmentHealth {
  return {
    available: health.available,
    parser: 'docling',
    message: health.message,
    details: health.details,
  };
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
  };
}

function validateUpload(fileName: string, fileBuffer: Buffer) {
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new HttpError(415, 'Only .pdf, .docx, and .xlsx files are supported in this version.');
  }

  if (!fileBuffer.length || fileBuffer.length > serverConfig.aiAttachmentMaxUploadBytes) {
    throw new HttpError(413, `Attachments must be between 1 byte and ${serverConfig.aiAttachmentMaxUploadBytes} bytes.`);
  }

  return extension;
}

function buildStoredRecord(args: {
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
  const isPdf = args.extension === '.pdf';
  const attachment: AiParsedAttachment = {
    id: args.id,
    createdAt,
    fileName: args.fileName,
    mediaType: args.mediaType,
    fileSize: args.fileBuffer.length,
    parser: 'docling',
    title: args.parsed.title || args.fileName.replace(/\.[^.]+$/, ''),
    textChars: args.parsed.text.length,
    chunkCount: chunks.length,
    warningCount: args.parsed.warnings.length,
    pageCount: isPdf ? pageCount : undefined,
    pdfReaderMode: isPdf ? classifyPdfReaderMode(pageCount) : undefined,
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

function sendRouteError(response: Response, error: unknown, fallback: string) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  response.status(statusCode).json({ ok: false, error: toErrorMessage(error, fallback) });
}

export async function handleGetAiAttachmentHealth(_request: Request, response: Response) {
  try {
    const health = await readParserHealth();
    response.json(toHealthPayload(health));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The local Docling parser is unavailable.';
    response.status(200).json({
      available: false,
      parser: 'docling',
      message: 'The local Docling parser is unavailable.',
      details: message,
    } satisfies AiAttachmentHealth);
  }
}

export async function handleParseAiAttachment(request: Request, response: Response) {
  try {
    const { fileName, mediaType, fileBuffer } = readParseBody(request);
    const extension = validateUpload(fileName, fileBuffer);
    const id = randomUUID();
    const sourcePath = await saveAttachmentSource(id, extension, fileBuffer);

    let parsed;
    try {
      parsed = await parseDocumentWithDocling(sourcePath);
    } catch (error) {
      await fs.unlink(sourcePath).catch(() => undefined);
      throw error;
    }

    const record = buildStoredRecord({ id, extension, fileBuffer, fileName, mediaType, parsed });
    await saveAttachmentRecord(record);
    response.status(201).json(toParsedAttachment(record));
  } catch (error) {
    sendRouteError(response, error, 'Unable to parse the uploaded attachment.');
  }
}

export async function handleGetAiAttachment(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const record = await readAttachmentRecord(attachmentId);
    response.json(toParsedAttachment(record));
  } catch (error) {
    sendRouteError(response, error, 'Unable to load the requested attachment.');
  }
}

export async function handleGetAiAttachmentContext(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const query = getOptionalQueryParam(request.query.query);
    const record = await readAttachmentRecord(attachmentId);
    const pdfMode = getPdfReaderMode(record);
    const payload =
      pdfMode === 'inline'
        ? {
            context: [
              `Brief PDF: ${record.attachment.fileName}`,
              `Pages: ${record.attachment.stats.pageCount}`,
              'The complete PDF content is loaded below. Briefly mention in the final answer that this was a brief PDF, so there was no need for a tool.',
              '',
              record.markdown,
            ].join('\n'),
            mode: 'inline' as const,
            selectedChunkCount: record.chunks.length,
          }
        : pdfMode === 'tool'
        ? {
            context: [
              `PDF: ${record.attachment.fileName}`,
              `Pages: ${record.attachment.stats.pageCount ?? 'unknown'}`,
              record.attachment.outline.length ? `Outline: ${record.attachment.outline.slice(0, 12).join(' | ')}` : null,
              `Preview: ${record.attachment.previewText}`,
              'Use pdf_reader to search or inspect specific pages.',
            ]
              .filter(Boolean)
              .join('\n'),
            mode: 'ranked' as const,
            selectedChunkCount: 0,
          }
        : buildAttachmentContext({
            fileName: record.attachment.fileName,
            markdown: record.markdown,
            chunks: record.chunks,
            outline: record.attachment.outline,
            query,
          });

    response.json({
      attachment: record.attachment,
      ...payload,
    });
  } catch (error) {
    sendRouteError(response, error, 'Unable to build attachment context for this turn.');
  }
}

export async function handleDeleteAiAttachment(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const record = await readAttachmentRecord(attachmentId);
    await deleteAttachmentRecord(attachmentId, record.sourceExtension);
    response.json({ ok: true });
  } catch (error) {
    sendRouteError(response, error, 'Unable to delete the requested attachment.');
  }
}
