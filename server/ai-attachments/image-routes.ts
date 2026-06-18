import { Request, Response } from 'express';
import { HttpError, getRequiredQueryParam } from '../http';
import { isStoredImageAttachmentRecord } from './record-guards';
import { sendAttachmentRouteError } from './route-errors';
import { getAttachmentSourcePath, readAttachmentRecord } from './storage';
import { analyzeStoredImage } from './image-analysis-service';
import { compareGeneratedImage } from './image-compare-service';
import { createImageToolTelemetryFromRequest, createRequestAbortController } from './image-tool-runtime';
import { answerImageQuestionWithVisionProvider, describeImageWithVisionProvider } from './vision-service';
import fs from 'node:fs/promises';

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

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

async function readStoredImageBase64(attachmentId: string, sourceExtension: string) {
  const sourcePath = getAttachmentSourcePath(attachmentId, sourceExtension);
  const imageBuffer = await fs.readFile(sourcePath);
  return imageBuffer.toString('base64');
}

export async function handlePostAiImageDescribe(request: Request, response: Response) {
  const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
  const { controller, cleanup } = createRequestAbortController(request);
  const telemetry = createImageToolTelemetryFromRequest(request, { toolName: 'describe_image', imageId: attachmentId });
  telemetry.log('tool_invocation_received');
  try {
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredImageAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not an image attachment.`);
    }
    telemetry.log('image_loaded');
    const payload = await describeImageWithVisionProvider(
      await readStoredImageBase64(attachmentId, record.sourceExtension),
      { mediaType: record.attachment.mediaType, signal: controller.signal, telemetry },
    );
    telemetry.log('tool_result_returned', { provider: payload.metadata.provider, model: payload.metadata.model, finalStatus: 'ok' });
    response.json({
      attachment: record.attachment,
      summary: payload.text,
      model: payload.metadata.model,
      metadata: payload.metadata,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    telemetry.log('tool_result_returned', { finalStatus: 'error', message: error instanceof Error ? error.message : 'Unable to describe this image.' });
    sendAttachmentRouteError(response, error, 'Unable to describe this image.');
  } finally {
    cleanup();
  }
}

export async function handlePostAiImageQuestion(request: Request, response: Response) {
  const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
  const { controller, cleanup } = createRequestAbortController(request);
  const telemetry = createImageToolTelemetryFromRequest(request, { toolName: 'ask_image_model', imageId: attachmentId });
  telemetry.log('tool_invocation_received');
  try {
    const question = readQuestion(request);
    const record = await readAttachmentRecord(attachmentId);
    if (!isStoredImageAttachmentRecord(record)) {
      throw new HttpError(415, `"${attachmentId}" is not an image attachment.`);
    }
    telemetry.log('image_loaded');

    const payload = await answerImageQuestionWithVisionProvider(
      await readStoredImageBase64(attachmentId, record.sourceExtension),
      question,
      { mediaType: record.attachment.mediaType, signal: controller.signal, telemetry },
    );
    telemetry.log('tool_result_returned', { provider: payload.metadata.provider, model: payload.metadata.model, finalStatus: 'ok' });
    response.json({
      attachment: record.attachment,
      answer: payload.text,
      question,
      model: payload.metadata.model,
      metadata: payload.metadata,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    telemetry.log('tool_result_returned', { finalStatus: 'error', message: error instanceof Error ? error.message : 'Unable to inspect this image.' });
    sendAttachmentRouteError(response, error, 'Unable to inspect this image.');
  } finally {
    cleanup();
  }
}

export async function handlePostAiImageAnalysis(request: Request, response: Response) {
  const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
  const refresh = readRefresh(request);
  const detail = readAnalysisDetail(request);
  const { controller, cleanup } = createRequestAbortController(request);
  const telemetry = createImageToolTelemetryFromRequest(request, { toolName: 'extract_image_scene', imageId: attachmentId, refresh, detail });
  telemetry.log('tool_invocation_received');
  try {
    const payload = await analyzeStoredImage(attachmentId, refresh, detail, { signal: controller.signal, telemetry });
    telemetry.log('tool_result_returned', { model: payload.model, finalStatus: 'ok' });
    response.json(payload);
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    telemetry.log('tool_result_returned', { finalStatus: 'error', message: error instanceof Error ? error.message : 'Unable to analyze this image.' });
    sendAttachmentRouteError(response, error, 'Unable to analyze this image.');
  } finally {
    cleanup();
  }
}

export async function handlePostAiImageCompare(request: Request, response: Response) {
  const attachmentId = getRequiredQueryParam(request.params.attachmentId, 'attachmentId');
  const compareRequest = readCompareRequest(request);
  const { controller, cleanup } = createRequestAbortController(request);
  const telemetry = createImageToolTelemetryFromRequest(request, { toolName: 'compare_generated_image', imageId: attachmentId, refresh: compareRequest.refresh });
  telemetry.log('tool_invocation_received');
  try {
    const payload = await compareGeneratedImage({ attachmentId, ...compareRequest, signal: controller.signal, telemetry });
    telemetry.log('tool_result_returned', { finalStatus: 'ok' });
    response.json(payload);
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    telemetry.log('tool_result_returned', { finalStatus: 'error', message: error instanceof Error ? error.message : 'Unable to compare this generated image.' });
    sendAttachmentRouteError(response, error, 'Unable to compare this generated image.');
  } finally {
    cleanup();
  }
}
