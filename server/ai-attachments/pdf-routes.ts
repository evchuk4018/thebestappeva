import { Request, Response } from 'express';
import { HttpError, getOptionalIntParam, getRequiredQueryParam, toErrorMessage } from '../http';
import { isStoredDocumentAttachmentRecord } from './record-guards';
import { findPdfPage, searchPdfPages, selectPdfPageRange } from './pdf-content';
import { ensurePdfPages } from './pdf-record';
import { renderPdfPage } from './parser';
import {
  getAttachmentSourcePath,
  readAttachmentRecord,
  readCachedPdfPageImage,
  saveCachedPdfPageImage,
} from './storage';

function sendRouteError(response: Response, error: unknown, fallback: string) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  response.status(statusCode).json({ ok: false, error: toErrorMessage(error, fallback) });
}

function readPageNumber(value: unknown) {
  const pageNumber = Number(getRequiredQueryParam(value, 'pageNumber'));
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new HttpError(400, 'pageNumber must be a positive integer.');
  }

  return pageNumber;
}

function readOptionalPageNumber(value: unknown, fallback: number, name: string) {
  if (typeof value === 'undefined') {
    return fallback;
  }

  const pageNumber = Number(value);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new HttpError(400, `${name} must be a positive integer.`);
  }

  return pageNumber;
}

export async function handleSearchAiPdf(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const query = getRequiredQueryParam(request.query.query, 'query');
    const limit = getOptionalIntParam(request.query.limit, 10, 1, 10);
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredDocumentAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not a PDF attachment.`);
    }
    const pages = await ensurePdfPages(record);
    const matches = searchPdfPages(pages, query, limit);

    response.json({
      attachment: record.attachment,
      matchCount: matches.length,
      matches,
      query,
    });
  } catch (error) {
    sendRouteError(response, error, 'Unable to search this PDF.');
  }
}

export async function handleGetAiPdfPage(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const pageNumber = readPageNumber(request.params.pageNumber);
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredDocumentAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not a PDF attachment.`);
    }
    const page = findPdfPage(await ensurePdfPages(record), pageNumber);
    response.json({ attachment: record.attachment, ...page });
  } catch (error) {
    sendRouteError(response, error, 'Unable to read this PDF page.');
  }
}

export async function handleGetAiPdfPages(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredDocumentAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not a PDF attachment.`);
    }
    const allPages = await ensurePdfPages(record);
    const startPage = readOptionalPageNumber(request.query.startPage, 1, 'startPage');
    const endPage = readOptionalPageNumber(request.query.endPage, allPages.length, 'endPage');
    const pages = selectPdfPageRange(allPages, startPage, endPage);

    response.json({
      attachment: record.attachment,
      pageCount: allPages.length,
      pages,
    });
  } catch (error) {
    sendRouteError(response, error, 'Unable to read these PDF pages.');
  }
}

export async function handleGetAiPdfPageImage(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const pageNumber = readPageNumber(request.params.pageNumber);
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredDocumentAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not a PDF attachment.`);
    }
    const page = findPdfPage(await ensurePdfPages(record), pageNumber);
    let image = await readCachedPdfPageImage(attachmentId, pageNumber);
    const cached = Boolean(image);

    if (!image) {
      const sourcePath = getAttachmentSourcePath(attachmentId, record.sourceExtension);
      const rendered = await renderPdfPage(sourcePath, pageNumber);
      image = Buffer.from(rendered.base64Data, 'base64');
      await saveCachedPdfPageImage(attachmentId, pageNumber, image);
    }

    response.json({
      attachment: record.attachment,
      base64Data: image.toString('base64'),
      cached,
      mediaType: 'image/png',
      pageNumber,
      text: page.text,
    });
  } catch (error) {
    sendRouteError(response, error, 'Unable to render this PDF page.');
  }
}
