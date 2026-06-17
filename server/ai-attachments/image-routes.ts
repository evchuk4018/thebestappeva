import { Request, Response } from 'express';
import { HttpError, getRequiredQueryParam } from '../http';
import { isStoredImageAttachmentRecord } from './record-guards';
import { sendAttachmentRouteError } from './route-errors';
import { getAttachmentSourcePath, readAttachmentRecord } from './storage';
import { analyzeStoredImage } from './image-analysis-service';
import { compareGeneratedImage } from './image-compare-service';
import { queryImageModel } from './vision-model';
import fs from 'node:fs/promises';

function readQuestion(request: Request) {
  const body = request.body as { question?: unknown } | null;
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) {
    throw new HttpError(400, 'Image queries require a non-empty "question" field.');
  }
  return question;
}

function readRefresh(request: Request) {
  const body = request.body as { refresh?: unknown } | null;
  return body?.refresh === true;
}

function readAnalysisDetail(request: Request) {
  const body = request.body as { detail?: unknown } | null;
  return body?.detail === 'semantic' ? 'semantic' : 'layout';
}

function readCompareRequest(request: Request) {
  const body = request.body as { content?: unknown; format?: unknown; iteration?: unknown; maxIterations?: unknown; refresh?: unknown } | null;
  const format = typeof body?.format === 'string' ? body.format.trim() : '';
  const content = typeof body?.content === 'string' ? body.content : '';
  if (format !== 'svg') {
    throw new HttpError(400, 'Image comparison currently supports format "svg" only.');
  }
  if (!content.trim()) {
    throw new HttpError(400, 'Image comparison requires non-empty "content".');
  }
  return {
    format,
    content,
    refresh: body?.refresh === true,
    iteration: typeof body?.iteration === 'number' ? body.iteration : undefined,
    maxIterations: typeof body?.maxIterations === 'number' ? body.maxIterations : undefined,
  } as const;
}

export async function handlePostAiImageQuestion(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    const question = readQuestion(request);
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredImageAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not an image attachment.`);
    }

    const sourcePath = getAttachmentSourcePath(attachmentId, record.sourceExtension);
    const imageBuffer = await fs.readFile(sourcePath);
    const payload = await queryImageModel(imageBuffer.toString('base64'), question);
    response.json({
      attachment: record.attachment,
      answer: payload.answer,
      question,
      model: payload.model,
    });
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to inspect this image.');
  }
}

export async function handlePostAiImageAnalysis(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    response.json(await analyzeStoredImage(attachmentId, readRefresh(request), readAnalysisDetail(request)));
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to analyze this image.');
  }
}

export async function handlePostAiImageCompare(request: Request, response: Response) {
  try {
    const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
    response.json(await compareGeneratedImage({ attachmentId, ...readCompareRequest(request) }));
  } catch (error) {
    sendAttachmentRouteError(response, error, 'Unable to compare this generated image.');
  }
}
