import { Request, Response } from 'express';
import { AiAttachmentHealth } from '../../shared/ai-attachments-contract';
import { HttpError, getOptionalQueryParam, getRequiredQueryParam } from '../http';
import { buildAttachmentContext } from './chunking';
import { parseIncomingAttachment, readAttachmentHealth, toHealthPayload } from './attachment-upload';
import { isStoredDocumentAttachmentRecord } from './record-guards';
import { getPdfReaderMode } from './pdf-record';
import { sendAttachmentRouteError } from './route-errors';
import { deleteAttachmentRecord, readAttachmentRecord, toParsedAttachment } from './storage';

function buildDocumentContext(record: ReturnType<typeof requireDocumentRecord>, query: string | undefined) {
  const pdfMode = getPdfReaderMode(record);
  if (pdfMode === 'inline') {
    return {
      context: [
        `Brief PDF: ${record.attachment.fileName}`,
        `Pages: ${record.attachment.stats.pageCount}`,
        'The complete PDF content is loaded below. Briefly mention in the final answer that this was a brief PDF, so there was no need for a tool.',
        '',
        record.markdown,
      ].join('\n'),
      mode: 'inline' as const,
      selectedChunkCount: record.chunks.length,
    };
  }

  if (pdfMode === 'tool') {
    return {
      context: [
        `PDF: ${record.attachment.fileName}`,
        `Pages: ${record.attachment.stats.pageCount ?? 'unknown'}`,
        record.attachment.outline.length ? `Outline: ${record.attachment.outline.slice(0, 12).join(' | ')}` : null,
        `Preview: ${record.attachment.previewText}`,
        'Use pdf_reader to search or inspect specific pages.',
      ].filter(Boolean).join('\n'),
      mode: 'ranked' as const,
      selectedChunkCount: 0,
    };
  }

  return buildAttachmentContext({
    fileName: record.attachment.fileName,
    markdown: record.markdown,
    chunks: record.chunks,
    outline: record.attachment.outline,
    query,
  });
}

function requireDocumentRecord(record: Awaited<ReturnType<typeof readAttachmentRecord>>) {
  if (!isStoredDocumentAttachmentRecord(record)) {
    throw new HttpError(415, `Attachment "${record.attachment.id}" does not provide document context.`);
  }
  return record;
}

export async function handleGetAiAttachmentHealth(_request: Request, response: Response) {
  const health = await readAttachmentHealth();
  response.status(200).json(toHealthPayload(health) satisfies AiAttachmentHealth);
}

export async function handleParseAiAttachment(request: Request, response: Response) {
  try {
    response.status(201).json(toParsedAttachment(await parseIncomingAttachment(request)));
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to parse the uploaded attachment.');
  }
}

export async function handleGetAiAttachment(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    response.json(toParsedAttachment(await readAttachmentRecord(attachmentId)));
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to load the requested attachment.');
  }
}

export async function handleGetAiAttachmentContext(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const query = getOptionalQueryParam(request.query.query);
    const record = requireDocumentRecord(await readAttachmentRecord(attachmentId));
    response.json({
      attachment: record.attachment,
      ...buildDocumentContext(record, query),
    });
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to build attachment context for this turn.');
  }
}

export async function handleDeleteAiAttachment(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const record = await readAttachmentRecord(attachmentId);
    await deleteAttachmentRecord(attachmentId, record.sourceExtension);
    response.json({ ok: true });
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to delete the requested attachment.');
  }
}
