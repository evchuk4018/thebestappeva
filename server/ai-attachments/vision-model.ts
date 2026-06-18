import { randomUUID } from 'node:crypto';
import { HttpError } from '../http';
import { serverConfig } from '../config';
import {
  type OllamaChatResponse,
  buildJsonPrompt,
  buildVisionModelUnavailableError,
  canonicalizeVisionModelName,
  isGpuKernelFailure,
  isTimeoutLikeError,
  listInstalledVisionModels,
  pullVisionModel,
  readJson,
  trimVisionModelName,
} from './vision-model-shared';
export { createImageAnalysisVisionSession } from './vision-model-image-analysis';

let preferCpuVisionRequests = false;

export function getPreferredVisionModels() {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const model of serverConfig.aiVisionModels) {
    const canonical = canonicalizeVisionModelName(model);
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    models.push(trimVisionModelName(model));
  }
  return models;
}

export async function ensureVisionModelReady() {
  try {
    const installedModels = await listInstalledVisionModels();
    const installedPreferred = getPreferredVisionModels().find((model) => installedModels.has(canonicalizeVisionModelName(model)));
    if (installedPreferred) {
      return installedModels.get(canonicalizeVisionModelName(installedPreferred)) ?? installedPreferred;
    }
    const modelToPull = getPreferredVisionModels()[0];
    return await pullVisionModel(modelToPull);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw buildVisionModelUnavailableError();
  }
}

function buildVisionChatBody(model: string, imageBase64: string, prompt: string, forceCpu: boolean) {
  return {
    model: trimVisionModelName(model),
    stream: false,
    think: false,
    messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
    options: forceCpu ? { num_gpu: 0 } : undefined,
  };
}

async function requestVisionChat(model: string, imageBase64: string, prompt: string, forceCpu: boolean) {
  try {
    const response = await fetch(`${serverConfig.ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildVisionChatBody(model, imageBase64, prompt, forceCpu)),
    });
    const payload = await readJson<OllamaChatResponse>(response, 'Unable to complete the local vision request.');
    if (payload.error?.trim()) {
      throw new HttpError(502, payload.error.trim());
    }
    const content = payload.message?.content?.trim();
    if (!content) {
      throw new HttpError(502, 'The local vision model returned an empty response.');
    }
    return content;
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      throw new HttpError(504, 'The local vision model timed out.');
    }
    throw error instanceof HttpError ? error : new HttpError(502, 'Unable to complete the local vision request.');
  }
}

async function askVisionModel(model: string, imageBase64: string, prompt: string) {
  if (preferCpuVisionRequests) {
    return requestVisionChat(model, imageBase64, prompt, true);
  }
  try {
    return await requestVisionChat(model, imageBase64, prompt, false);
  } catch (error) {
    if (!(error instanceof HttpError) || !isGpuKernelFailure(error.message)) {
      throw error;
    }
    preferCpuVisionRequests = true;
    return requestVisionChat(model, imageBase64, prompt, true);
  }
}

export async function queryVisionModelJson<T>(imageBase64: string, instructions: string[], parser: (value: unknown) => T) {
  const model = await ensureVisionModelReady();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await askVisionModel(model, imageBase64, buildJsonPrompt(instructions, attempt, randomUUID()));
    try {
      return { model, value: parser(JSON.parse(raw) as unknown) };
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'The local vision model returned invalid JSON.';
  throw new HttpError(502, message);
}

export async function describeLocalImage(imageBase64: string) {
  const model = await ensureVisionModelReady();
  const summary = await askVisionModel(
    model,
    imageBase64,
    [
      'You are summarizing an uploaded image for a separate text-only model.',
      'Return a brief 2-3 sentence visual summary covering the main subject, any notable text, and the overall layout.',
      'Do not speculate beyond what is visible.',
    ].join(' '),
  );
  return { model, summary };
}

export async function answerLocalImageQuestion(imageBase64: string, question: string) {
  const model = await ensureVisionModelReady();
  const answer = await askVisionModel(
    model,
    imageBase64,
    [
      'Answer the user question about this image directly and concisely.',
      'Only describe what is visible in the image.',
      `Question: ${question.trim()}`,
      `Request ID: ${randomUUID()}`,
    ].join('\n'),
  );
  return { answer, model };
}

export const generateImageSummary = describeLocalImage;
export const queryImageModel = answerLocalImageQuestion;

export function resetVisionModelStateForTests() {
  preferCpuVisionRequests = false;
}
