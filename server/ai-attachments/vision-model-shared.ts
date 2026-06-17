import { serverConfig } from '../config';
import { HttpError } from '../http';

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

export interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

export function trimVisionModelName(model: string) {
  return model.trim();
}

export function canonicalizeVisionModelName(model: string) {
  return trimVisionModelName(model).replace(/^qwen3-vl:/i, 'qwen3vl:');
}

export function getVisionModelAliases(model: string) {
  const trimmed = trimVisionModelName(model);
  const canonical = canonicalizeVisionModelName(trimmed);
  if (!canonical.startsWith('qwen3vl:')) {
    return [trimmed];
  }
  const suffix = canonical.slice('qwen3vl:'.length);
  return [`qwen3-vl:${suffix}`, `qwen3vl:${suffix}`];
}

export function buildVisionModelUnavailableError() {
  return new HttpError(503, 'Unable to prepare a local Ollama vision model for image understanding.');
}

export function isGpuKernelFailure(message: string) {
  return /cuda error: device kernel image is invalid|stack-based buffer|llama-server process has terminated/i.test(message);
}

export async function readJson<T>(response: Response, fallback: string) {
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

export async function listInstalledVisionModels() {
  const response = await fetch(`${serverConfig.ollamaHost}/api/tags`);
  const payload = await readJson<OllamaTagsResponse>(response, 'Unable to inspect local Ollama models.');
  return new Map(
    (payload.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((name) => [canonicalizeVisionModelName(name), name] as const),
  );
}

export async function pullVisionModel(model: string) {
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
  throw lastError ?? buildVisionModelUnavailableError();
}

export function buildJsonPrompt(instructions: string[], attempt: number, requestId: string) {
  return [
    ...instructions,
    'Respond with JSON only. Do not include Markdown fences, prose, or commentary.',
    attempt > 0 ? 'Your previous response was not valid JSON. Return one valid JSON object only.' : null,
    `Request ID: ${requestId}`,
  ].filter(Boolean).join('\n');
}

export function isTimeoutLikeError(error: unknown) {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}
