import { randomUUID } from 'node:crypto';
import { HttpError } from '../http';
import { serverConfig } from '../config';

const preferredVisionModels = ['openbmb/minicpm-v4.5:8b', 'qwen2.5vl:7b'] as const;

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

let preferCpuVisionRequests = false;

function buildModelUnavailableError() {
  return new HttpError(503, 'Unable to prepare a local Ollama vision model for image understanding.');
}

async function readJson<T>(response: Response, fallback: string) {
  if (!response.ok) {
    const message = (await response.text()).trim() || fallback;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpError(502, fallback);
  }
}

async function listInstalledModels() {
  const response = await fetch(`${serverConfig.ollamaHost}/api/tags`);
  const payload = await readJson<OllamaTagsResponse>(response, 'Unable to inspect local Ollama models.');
  return new Set(
    (payload.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name)),
  );
}

async function pullModel(model: string) {
  const response = await fetch(`${serverConfig.ollamaHost}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model }),
  });

  if (!response.ok) {
    const message = (await response.text()).trim() || `Unable to pull ${model}.`;
    throw new HttpError(response.status >= 500 ? 502 : response.status, message);
  }

  if (!response.body) {
    throw new HttpError(502, `Ollama did not return pull progress for ${model}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const payload = JSON.parse(trimmed) as { error?: string };
      if (payload.error?.trim()) {
        throw new HttpError(502, payload.error.trim());
      }
    }
  }

  if (buffer.trim()) {
    const payload = JSON.parse(buffer.trim()) as { error?: string };
    if (payload.error?.trim()) {
      throw new HttpError(502, payload.error.trim());
    }
  }
}

export async function ensureVisionModelReady() {
  try {
    const installedModels = await listInstalledModels();
    const installedPreferred = preferredVisionModels.find((model) => installedModels.has(model));
    if (installedPreferred) {
      return installedPreferred;
    }

    const modelToPull = preferredVisionModels[0];
    await pullModel(modelToPull);
    return modelToPull;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw buildModelUnavailableError();
  }
}

function isGpuKernelFailure(message: string) {
  return /cuda error: device kernel image is invalid|stack-based buffer|llama-server process has terminated/i.test(message);
}

function buildVisionChatBody(model: string, imageBase64: string, prompt: string, forceCpu: boolean) {
  return {
    model,
    stream: false,
    think: false,
    messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
    options: forceCpu ? { num_gpu: 0 } : undefined,
  };
}

async function requestVisionChat(model: string, imageBase64: string, prompt: string, forceCpu: boolean) {
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

export async function generateImageSummary(imageBase64: string) {
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

export async function queryImageModel(imageBase64: string, question: string) {
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

export function resetVisionModelStateForTests() {
  preferCpuVisionRequests = false;
}
