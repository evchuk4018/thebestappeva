import { Request, Response } from 'express';
import { HttpError, getRequiredQueryParam } from '../http';
import { isStoredImageAttachmentRecord } from './record-guards';
import { sendAttachmentRouteError } from './route-errors';
import { getAttachmentSourcePath, readAttachmentRecord } from './storage';
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
