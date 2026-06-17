import { randomUUID } from 'node:crypto';
import { serverConfig } from '../config';
import { fetchWithTimeout, HttpError } from '../http';
import {
  type OllamaChatResponse,
  buildJsonPrompt,
  buildVisionModelUnavailableError,
  canonicalizeVisionModelName,
  getVisionModelAliases,
  isTimeoutLikeError,
  readJson,
  trimVisionModelName,
} from './vision-model-shared';

interface OllamaPsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

const warmKeepAlive = '5m';

export interface ImageAnalysisVisionSession {
  dispose(): Promise<void>;
  queryJson<T>(passName: string, isFinalPass: boolean, imageBase64: string, instructions: string[], parser: (value: unknown) => T): Promise<{ model: string; value: T }>;
}

function buildPassLabel(passName: string) {
  return passName.trim() || 'unknown';
}

function buildStrictVisionError(model: string, passName: string, detail: string, statusCode = 502) {
  return new HttpError(statusCode, `Image analysis vision model "${model}" ${detail} on pass "${buildPassLabel(passName)}".`);
}

async function ensureImageAnalysisModelReady() {
  try {
    const configuredModel = trimVisionModelName(serverConfig.aiImageAnalysisVisionModel);
    const tagsResponse = await fetchWithTimeout(`${serverConfig.ollamaHost}/api/tags`, {}, serverConfig.aiImageAnalysisVisionTimeoutMs);
    const payload = await readJson<{ models?: Array<{ name?: string }> }>(tagsResponse, 'Unable to inspect local Ollama models for image analysis.');
    const installedModels = new Map(
      (payload.models ?? [])
        .map((model) => model.name?.trim())
        .filter((name): name is string => Boolean(name))
        .map((name) => [canonicalizeVisionModelName(name), name] as const),
    );
    const installedModel = installedModels.get(canonicalizeVisionModelName(configuredModel));
    if (installedModel) {
      return installedModel;
    }
    for (const candidate of getVisionModelAliases(configuredModel)) {
      const response = await fetchWithTimeout(`${serverConfig.ollamaHost}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: candidate }),
      }, serverConfig.aiImageAnalysisVisionTimeoutMs);
      if (response.ok) {
        return candidate;
      }
      await response.text();
    }
    throw buildVisionModelUnavailableError();
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      throw new HttpError(504, `Preparing the image analysis vision model timed out after ${serverConfig.aiImageAnalysisVisionTimeoutMs}ms.`);
    }
    if (error instanceof HttpError) {
      throw error;
    }
    throw buildVisionModelUnavailableError();
  }
}

async function listRunningModels() {
  try {
    const response = await fetchWithTimeout(`${serverConfig.ollamaHost}/api/ps`, {}, serverConfig.aiImageAnalysisVisionTimeoutMs);
    const payload = await readJson<OllamaPsResponse>(response, 'Unable to inspect loaded Ollama models before image analysis.');
    return (payload.models ?? [])
      .map((model) => model.name?.trim() || model.model?.trim() || '')
      .filter(Boolean);
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      throw new HttpError(504, `Checking loaded Ollama models timed out after ${serverConfig.aiImageAnalysisVisionTimeoutMs}ms.`);
    }
    throw error instanceof HttpError ? error : new HttpError(502, 'Unable to inspect loaded Ollama models before image analysis.');
  }
}

async function unloadModel(model: string) {
  try {
    const response = await fetchWithTimeout(`${serverConfig.ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: trimVisionModelName(model),
        prompt: '',
        stream: false,
        keep_alive: 0,
      }),
    }, serverConfig.aiImageAnalysisVisionTimeoutMs);
    await response.text();
  } catch {
    return;
  }
}

async function evictNonTargetModels(model: string) {
  const target = canonicalizeVisionModelName(model);
  const loadedBefore = await listRunningModels();
  const otherModels = loadedBefore.filter((candidate) => canonicalizeVisionModelName(candidate) !== target);
  for (const candidate of otherModels) {
    await unloadModel(candidate);
  }
  const loadedAfter = await listRunningModels();
  const remainingModels = loadedAfter.filter((candidate) => canonicalizeVisionModelName(candidate) !== target);
  if (remainingModels.length) {
    throw new HttpError(
      503,
      `Image analysis requires "${model}" to be the only loaded Ollama model, but these remain loaded: ${remainingModels.join(', ')}.`,
    );
  }
}

async function requestImageAnalysisChat(model: string, passName: string, imageBase64: string, prompt: string, keepAlive: string | number) {
  try {
    const response = await fetchWithTimeout(`${serverConfig.ollamaHost}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: trimVisionModelName(model),
        stream: false,
        think: false,
        keep_alive: keepAlive,
        messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
      }),
    }, serverConfig.aiImageAnalysisVisionTimeoutMs);
    const payload = await readJson<OllamaChatResponse>(
      response,
      `Unable to complete the image analysis vision request for "${model}" on pass "${buildPassLabel(passName)}".`,
    );
    if (payload.error?.trim()) {
      throw buildStrictVisionError(model, passName, `failed: ${payload.error.trim()}`);
    }
    const content = payload.message?.content?.trim();
    if (!content) {
      throw buildStrictVisionError(model, passName, 'returned an empty response');
    }
    return content;
  } catch (error) {
    if (isTimeoutLikeError(error)) {
      throw buildStrictVisionError(
        model,
        passName,
        `timed out after ${serverConfig.aiImageAnalysisVisionTimeoutMs}ms`,
        504,
      );
    }
    throw error instanceof HttpError
      ? error
      : buildStrictVisionError(model, passName, 'failed before a response was returned');
  }
}

export async function createImageAnalysisVisionSession(): Promise<ImageAnalysisVisionSession> {
  const model = await ensureImageAnalysisModelReady();
  await evictNonTargetModels(model);
  let disposed = false;
  let shouldUnloadOnDispose = false;

  return {
    async dispose() {
      if (disposed || !shouldUnloadOnDispose) {
        disposed = true;
        return;
      }
      disposed = true;
      shouldUnloadOnDispose = false;
      await unloadModel(model);
    },
    async queryJson<T>(passName, isFinalPass, imageBase64, instructions, parser) {
      if (disposed) {
        throw new Error('Image analysis vision session has already been disposed.');
      }
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        shouldUnloadOnDispose = true;
        const raw = await requestImageAnalysisChat(
          model,
          passName,
          imageBase64,
          buildJsonPrompt(instructions, attempt, randomUUID()),
          isFinalPass ? 0 : warmKeepAlive,
        );
        try {
          const value = parser(JSON.parse(raw) as unknown);
          shouldUnloadOnDispose = !isFinalPass;
          return { model, value };
        } catch (error) {
          lastError = error;
        }
      }
      const message = lastError instanceof Error ? lastError.message : 'The image analysis vision model returned invalid JSON.';
      throw buildStrictVisionError(model, passName, `returned invalid JSON: ${message}`);
    },
  };
}
