import { serverConfig } from '../config';
import { HttpError } from '../http';
import type { AiVisionMetadata, AiVisionMode } from '../../shared/ai-vision-contract';
import { createGeminiVisionProvider } from './gemini-vision-provider';
import { runImageToolWithRetries } from './image-tool-runtime';
import { createLocalVisionProvider } from './local-vision-provider';
import type { ResolvedVisionResult, VisionProvider, VisionProviderResult, VisionRequestOptions } from './vision-provider-types';

const localProvider = createLocalVisionProvider();
const geminiProvider = createGeminiVisionProvider();
const fallbackNotice = 'Online vision was unavailable. This image was analyzed using the local vision model.';
let testHooks: Partial<{
  mode: AiVisionMode;
  localProvider: VisionProvider;
  onlineProvider: VisionProvider;
}> = {};

function getEffectiveVisionMode(options: VisionRequestOptions = {}): AiVisionMode {
  return testHooks.mode ?? options.visionMode ?? serverConfig.visionMode;
}

function getOnlineProvider() {
  if (testHooks.onlineProvider) {
    return testHooks.onlineProvider;
  }
  if (serverConfig.onlineVisionProvider === 'gemini') {
    return geminiProvider;
  }
  throw new HttpError(500, `Unsupported online vision provider "${serverConfig.onlineVisionProvider}".`);
}

function getLocalProvider() {
  return testHooks.localProvider ?? localProvider;
}

async function runProviderWithRetries(
  provider: VisionProvider,
  action: (activeProvider: VisionProvider) => Promise<VisionProviderResult>,
  options: VisionRequestOptions,
  operationName: string,
) {
  const telemetry = options.telemetry ?? {
    requestId: 'vision-service',
    toolName: 'vision-service',
    imageId: 'inline-image',
    log() {},
    withAttempt() { return this; },
  };
  return runImageToolWithRetries(
    {
      signal: options.signal,
      telemetry,
      operationName,
    },
    async (attempt) => action({
      ...provider,
      describeImage: (imageBase64, providerOptions) => provider.describeImage(imageBase64, { ...providerOptions, signal: attempt.signal, telemetry: attempt.telemetry }),
      answerImageQuestion: (imageBase64, question, providerOptions) => provider.answerImageQuestion(imageBase64, question, { ...providerOptions, signal: attempt.signal, telemetry: attempt.telemetry }),
    }),
  );
}

function buildMetadata(
  mode: AiVisionMode,
  result: VisionProviderResult,
  startedAt: number,
  fallbackUsed: boolean,
  fallbackReason?: string,
): AiVisionMetadata {
  const metadata: AiVisionMetadata = {
    mode,
    provider: result.provider,
    model: result.model,
    fallbackUsed,
    fallbackReason,
    latencyMs: Date.now() - startedAt,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    totalTokens: result.totalTokens,
    estimatedCostUsd: result.estimatedCostUsd,
  };
  if (fallbackUsed) {
    metadata.notice = fallbackNotice;
  }
  return metadata;
}

function logVisionEvent(operation: 'describe' | 'question', metadata: AiVisionMetadata) {
  console.info(JSON.stringify({
    event: 'vision_request',
    operation,
    selectedMode: metadata.mode,
    provider: metadata.provider,
    model: metadata.model,
    fallbackUsed: metadata.fallbackUsed,
    fallbackReason: metadata.fallbackReason,
    latencyMs: metadata.latencyMs,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    totalTokens: metadata.totalTokens,
    estimatedCostUsd: metadata.estimatedCostUsd,
  }));
}

async function resolveVisionResult(
  operation: 'describe' | 'question',
  action: (provider: VisionProvider) => Promise<VisionProviderResult>,
  options: VisionRequestOptions = {},
): Promise<ResolvedVisionResult> {
  const mode = getEffectiveVisionMode(options);
  const startedAt = Date.now();
  if (mode === 'offline') {
    const result = await runProviderWithRetries(getLocalProvider(), action, options, 'Image inspection');
    const metadata = buildMetadata(mode, result, startedAt, false);
    logVisionEvent(operation, metadata);
    return { text: result.text, metadata };
  }

  try {
    const result = await runProviderWithRetries(getOnlineProvider(), action, options, 'Image inspection');
    const metadata = buildMetadata(mode, result, startedAt, false);
    logVisionEvent(operation, metadata);
    return { text: result.text, metadata };
  } catch (error) {
    const fallbackResult = await action(getLocalProvider());
    const fallbackReason = error instanceof Error ? error.message : 'The online vision provider was unavailable.';
    const metadata = buildMetadata(mode, fallbackResult, startedAt, true, fallbackReason);
    logVisionEvent(operation, metadata);
    return { text: fallbackResult.text, metadata };
  }
}

export async function describeImageWithVisionProvider(imageBase64: string, options: VisionRequestOptions = {}) {
  return resolveVisionResult('describe', (provider) => provider.describeImage(imageBase64, options), options);
}

export async function answerImageQuestionWithVisionProvider(
  imageBase64: string,
  question: string,
  options: VisionRequestOptions = {},
) {
  return resolveVisionResult('question', (provider) => provider.answerImageQuestion(imageBase64, question, options), options);
}

export function setVisionServiceTestHooksForTests(hooks: typeof testHooks) {
  testHooks = hooks;
}
