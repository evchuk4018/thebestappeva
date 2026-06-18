import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { HttpError } from '../http';

export const IMAGE_TOOL_ATTEMPT_TIMEOUT_MS = 30_000;
export const IMAGE_TOOL_MAX_ATTEMPTS = 2;
export const IMAGE_TOOL_RETRY_DELAY_MS = 1_000;
export const IMAGE_TOOL_TOTAL_TIMEOUT_MS = 65_000;
let attemptTimeoutMs = IMAGE_TOOL_ATTEMPT_TIMEOUT_MS;
let retryDelayMs = IMAGE_TOOL_RETRY_DELAY_MS;
let totalTimeoutMs = IMAGE_TOOL_TOTAL_TIMEOUT_MS;

export type ImageToolStage =
  | 'tool_invocation_received'
  | 'image_loaded'
  | 'provider_request_started'
  | 'provider_response_received'
  | 'response_parsing_started'
  | 'response_parsing_completed'
  | 'scene_parsing_started'
  | 'scene_parsing_completed'
  | 'tool_result_returned'
  | 'timeout'
  | 'cancellation'
  | 'retry_scheduled'
  | 'retry_started';

export interface ImageToolLogRecord {
  event: 'image_tool';
  timestamp: string;
  elapsedMs: number;
  stage: ImageToolStage;
  toolName: string;
  requestId: string;
  toolCallId?: string;
  imageId: string;
  provider?: string;
  model?: string;
  attempt?: number;
  refresh?: boolean;
  detail?: string;
  finalStatus?: 'ok' | 'error' | 'timeout' | 'cancelled' | 'retrying';
  message?: string;
}

export interface ImageToolTelemetry {
  readonly requestId: string;
  readonly toolCallId?: string;
  readonly toolName: string;
  readonly imageId: string;
  readonly attempt?: number;
  log(stage: ImageToolStage, details?: Partial<Omit<ImageToolLogRecord, 'event' | 'timestamp' | 'elapsedMs' | 'stage'>>): void;
  withAttempt(attempt: number): ImageToolTelemetry;
}

export interface ImageToolExecutionOptions {
  signal?: AbortSignal;
  telemetry: ImageToolTelemetry;
  operationName: string;
}

export interface ImageToolAttemptContext {
  signal: AbortSignal;
  telemetry: ImageToolTelemetry;
  attempt: number;
}

let logSink: (record: ImageToolLogRecord) => void = (record) => {
  console.info(JSON.stringify(record));
};

export class ImageToolTimeoutError extends HttpError {
  constructor(message: string) {
    super(504, message);
    this.name = 'ImageToolTimeoutError';
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isTimeoutLikeError(error: unknown) {
  return error instanceof ImageToolTimeoutError
    || (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'ImageToolTimeoutError'));
}

function isTransientNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return /(econnreset|eai_again|enotfound|etimedout|socket hang up|temporary network|network error)/i.test(message);
}

export function isRetryableImageToolError(error: unknown) {
  if (isTimeoutLikeError(error) || isTransientNetworkError(error)) {
    return true;
  }
  return error instanceof HttpError && [408, 429, 500, 502, 503, 504].includes(error.statusCode);
}

function createTelemetry(base: {
  startedAt: number;
  toolName: string;
  requestId: string;
  toolCallId?: string;
  imageId: string;
  refresh?: boolean;
  detail?: string;
  attempt?: number;
}): ImageToolTelemetry {
  return {
    requestId: base.requestId,
    toolCallId: base.toolCallId,
    toolName: base.toolName,
    imageId: base.imageId,
    attempt: base.attempt,
    log(stage, details = {}) {
      logSink({
        event: 'image_tool',
        timestamp: new Date().toISOString(),
        elapsedMs: Date.now() - base.startedAt,
        stage,
        toolName: base.toolName,
        requestId: base.requestId,
        toolCallId: base.toolCallId,
        imageId: base.imageId,
        refresh: base.refresh,
        detail: base.detail,
        attempt: base.attempt,
        ...details,
      });
    },
    withAttempt(attempt) {
      return createTelemetry({ ...base, attempt });
    },
  };
}

function abortWithReason(controller: AbortController, reason: unknown) {
  if (!controller.signal.aborted) {
    controller.abort(reason);
  }
}

function createCombinedSignal(signals: Array<AbortSignal | undefined>) {
  const controller = new AbortController();
  const cleanups: Array<() => void> = [];
  for (const signal of signals) {
    if (!signal) {
      continue;
    }
    if (signal.aborted) {
      abortWithReason(controller, signal.reason);
      break;
    }
    const onAbort = () => abortWithReason(controller, signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    cleanups.push(() => signal.removeEventListener('abort', onAbort));
  }
  return {
    signal: controller.signal,
    cleanup() {
      cleanups.forEach((cleanup) => cleanup());
    },
  };
}

async function delayWithSignal(delayMs: number, signal?: AbortSignal) {
  if (!delayMs) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(resolve, delayMs);
    if (!signal) {
      return;
    }
    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(signal.reason ?? new DOMException('The request was aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function normalizeAttemptError(error: unknown, signal: AbortSignal, operationName: string, finalAttempt: boolean) {
  if (isAbortError(error) && signal.reason instanceof ImageToolTimeoutError) {
    return finalAttempt
      ? new ImageToolTimeoutError(`${operationName} timed out after two attempts. The request was cancelled rather than left running.`)
      : signal.reason;
  }
  if (error instanceof ImageToolTimeoutError && finalAttempt) {
    return new ImageToolTimeoutError(`${operationName} timed out after two attempts. The request was cancelled rather than left running.`);
  }
  if (error instanceof HttpError || error instanceof Error) {
    return error;
  }
  return new HttpError(502, `${operationName} failed unexpectedly.`);
}

export function createImageToolTelemetryFromRequest(request: Request, details: {
  toolName: string;
  imageId: string;
  refresh?: boolean;
  detail?: string;
}) {
  const headerValue = (name: string) => {
    const direct = typeof request.get === 'function' ? request.get(name) : undefined;
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }
    const fromHeaders = (request.headers?.[name] ?? request.headers?.[name.toLowerCase()]) as string | string[] | undefined;
    return typeof fromHeaders === 'string' && fromHeaders.trim() ? fromHeaders.trim() : undefined;
  };
  const requestId = headerValue('x-ai-image-request-id') || randomUUID();
  const toolCallId = headerValue('x-ai-tool-call-id');
  return createTelemetry({
    startedAt: Date.now(),
    toolName: details.toolName,
    requestId,
    toolCallId,
    imageId: details.imageId,
    refresh: details.refresh,
    detail: details.detail,
  });
}

export function createRequestAbortController(request: Request) {
  const controller = new AbortController();
  const abort = () => abortWithReason(controller, new DOMException('The client disconnected.', 'AbortError'));
  request.once?.('aborted', abort);
  request.once?.('close', abort);
  return {
    controller,
    cleanup() {
      request.off?.('aborted', abort);
      request.off?.('close', abort);
    },
  };
}

export async function runImageToolWithRetries<T>(
  options: ImageToolExecutionOptions,
  action: (context: ImageToolAttemptContext) => Promise<T>,
) {
  const totalController = new AbortController();
  const totalTimeoutId = setTimeout(() => {
    abortWithReason(totalController, new ImageToolTimeoutError(`${options.operationName} timed out after two attempts. The request was cancelled rather than left running.`));
  }, totalTimeoutMs);
  const totalSignal = createCombinedSignal([options.signal, totalController.signal]);

  try {
    for (let attempt = 1; attempt <= IMAGE_TOOL_MAX_ATTEMPTS; attempt += 1) {
      const telemetry = options.telemetry.withAttempt(attempt);
      const attemptController = new AbortController();
      const attemptTimeoutId = setTimeout(() => {
        abortWithReason(attemptController, new ImageToolTimeoutError(`${options.operationName} timed out on attempt ${attempt}.`));
      }, attemptTimeoutMs);
      const combined = createCombinedSignal([totalSignal.signal, attemptController.signal]);

      if (attempt > 1) {
        telemetry.log('retry_started', { finalStatus: 'retrying' });
      }

      try {
        return await action({ signal: combined.signal, telemetry, attempt });
      } catch (error) {
        const finalAttempt = attempt === IMAGE_TOOL_MAX_ATTEMPTS;
        const normalized = normalizeAttemptError(error, combined.signal, options.operationName, finalAttempt);
        const stage = isTimeoutLikeError(normalized) ? 'timeout' : isAbortError(normalized) ? 'cancellation' : undefined;
        if (stage) {
          telemetry.log(stage, {
            finalStatus: finalAttempt ? (stage === 'timeout' ? 'timeout' : 'cancelled') : 'retrying',
            message: normalized.message,
          });
        }
        if (finalAttempt || !isRetryableImageToolError(normalized)) {
          throw normalized;
        }
        telemetry.log('retry_scheduled', { finalStatus: 'retrying', message: normalized.message });
        await delayWithSignal(retryDelayMs, totalSignal.signal);
      } finally {
        clearTimeout(attemptTimeoutId);
        combined.cleanup();
      }
    }
    throw new ImageToolTimeoutError(`${options.operationName} timed out after two attempts. The request was cancelled rather than left running.`);
  } finally {
    clearTimeout(totalTimeoutId);
    totalSignal.cleanup();
  }
}

export function setImageToolLogSinkForTests(sink: ((record: ImageToolLogRecord) => void) | null) {
  logSink = sink ?? ((record) => console.info(JSON.stringify(record)));
}

export function setImageToolTimingForTests(timing: { attemptTimeoutMs?: number; retryDelayMs?: number; totalTimeoutMs?: number } | null) {
  attemptTimeoutMs = timing?.attemptTimeoutMs ?? IMAGE_TOOL_ATTEMPT_TIMEOUT_MS;
  retryDelayMs = timing?.retryDelayMs ?? IMAGE_TOOL_RETRY_DELAY_MS;
  totalTimeoutMs = timing?.totalTimeoutMs ?? IMAGE_TOOL_TOTAL_TIMEOUT_MS;
}
