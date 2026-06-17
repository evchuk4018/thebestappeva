import { randomUUID } from 'node:crypto';
import { HttpError } from '../http';
import { serverConfig } from '../config';

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

let preferCpuVisionRequests = false;

function trimVisionModelName(model: string) {
  return model.trim();
}

function canonicalizeVisionModelName(model: string) {
  return trimVisionModelName(model).replace(/^qwen3-vl:/i, 'qwen3vl:');
}

function getVisionModelAliases(model: string) {
  const trimmed = trimVisionModelName(model);
  const canonical = canonicalizeVisionModelName(trimmed);
  if (!canonical.startsWith('qwen3vl:')) {
    return [trimmed];
  }
  const suffix = canonical.slice('qwen3vl:'.length);
  return [`qwen3-vl:${suffix}`, `qwen3vl:${suffix}`];
}

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
  return new Map(
    (payload.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => [canonicalizeVisionModelName(name), name] as const),
  );
}

async function pullModel(model: string) {
  let lastError: HttpError | null = null;
  for (const candidate of getVisionModelAliases(model)) {
    const response = await fetch(`${serverConfig.ollamaHost}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: candidate }),
    });
    if (response.ok) {
      return candidate;
    }
    const message = (await response.text()).trim() || `Unable to pull ${candidate}.`;
    lastError = new HttpError(response.status >= 500 ? 502 : response.status, message);
  }
  throw lastError ?? buildModelUnavailableError();
}

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
    const installedModels = await listInstalledModels();
    const installedPreferred = getPreferredVisionModels().find((model) => installedModels.has(canonicalizeVisionModelName(model)));
    if (installedPreferred) {
      return installedModels.get(canonicalizeVisionModelName(installedPreferred)) ?? installedPreferred;
    }
    const modelToPull = getPreferredVisionModels()[0];
    return await pullModel(modelToPull);
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
    model: trimVisionModelName(model),
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

function buildJsonPrompt(instructions: string[], attempt: number) {
  return [
    ...instructions,
    'Respond with JSON only. Do not include Markdown fences, prose, or commentary.',
    attempt > 0 ? 'Your previous response was not valid JSON. Return one valid JSON object only.' : null,
    `Request ID: ${randomUUID()}`,
  ].filter(Boolean).join('\n');
}

export async function queryVisionModelJson<T>(imageBase64: string, instructions: string[], parser: (value: unknown) => T) {
  const model = await ensureVisionModelReady();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await askVisionModel(model, imageBase64, buildJsonPrompt(instructions, attempt));
    try {
      return { model, value: parser(JSON.parse(raw) as unknown) };
    } catch (error) {
      lastError = error;
    }
  }
  const message = lastError instanceof Error ? lastError.message : 'The local vision model returned invalid JSON.';
  throw new HttpError(502, message);
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
