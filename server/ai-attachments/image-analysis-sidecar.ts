import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { parseAiImageSceneGraph, type AiImageSceneGraph } from '../../shared/ai-image-scene-contract';
import { serverConfig } from '../config';
import { HttpError } from '../http';
import { IMAGE_TOOL_ATTEMPT_TIMEOUT_MS, type ImageToolTelemetry } from './image-tool-runtime';

const sidecarScriptPath = path.resolve(process.cwd(), 'python', 'image_analysis_sidecar.py');

export interface ImageAnalysisSidecarResult {
  debugImages: Record<string, Buffer>;
  sceneGraph: AiImageSceneGraph;
}

interface ImageAnalysisSidecarOptions {
  signal?: AbortSignal;
  telemetry?: ImageToolTelemetry;
}

let runSidecarHook: ((args: string[]) => Promise<string>) | null = null;
let worker: ImageAnalysisWorker | null = null;

interface WorkerRequest {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timeoutId: NodeJS.Timeout;
}

interface ImageAnalysisWorker {
  child: ChildProcessWithoutNullStreams;
  pending: Map<string, WorkerRequest>;
  nextId: number;
  stderr: string[];
  stdoutBuffer: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSceneGraphForSidecar(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.objects)) {
    return value;
  }
  return {
    ...value,
    objects: value.objects.map((item) => {
      if (!isRecord(item)) {
        return item;
      }
      const normalized = { ...item };
      if (normalized.polygon === null) {
        delete normalized.polygon;
      }
      if (normalized.line === null) {
        delete normalized.line;
      }
      return normalized;
    }),
  };
}

function runSidecar(args: string[]) {
  if (runSidecarHook) {
    return runSidecarHook(args);
  }
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      serverConfig.aiImageAnalysisPythonCommand,
      [...serverConfig.aiImageAnalysisPythonArgs, sidecarScriptPath, ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, `The local image-analysis sidecar timed out after ${serverConfig.aiImageAnalysisTimeoutMs}ms.`));
    }, serverConfig.aiImageAnalysisTimeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(new HttpError(503, `Unable to start the local image-analysis sidecar: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new HttpError(503, stderr.join('').trim() || `The local image-analysis sidecar exited with code ${code}.`));
        return;
      }
      resolve(stdout.join(''));
    });
  });
}

function rejectPending(workerState: ImageAnalysisWorker, error: Error) {
  for (const request of workerState.pending.values()) {
    clearTimeout(request.timeoutId);
    request.reject(error);
  }
  workerState.pending.clear();
}

function parseWorkerLine(workerState: ImageAnalysisWorker, line: string) {
  if (!line.trim()) {
    return;
  }
  let payload: { id?: string; ok?: boolean; payload?: unknown; error?: string };
  try {
    payload = JSON.parse(line) as typeof payload;
  } catch {
    return;
  }
  const id = payload.id ?? '';
  const request = workerState.pending.get(id);
  if (!request) {
    return;
  }
  workerState.pending.delete(id);
  clearTimeout(request.timeoutId);
  if (payload.ok) {
    request.resolve(JSON.stringify(payload.payload));
    return;
  }
  request.reject(new HttpError(503, payload.error || 'The local image-analysis worker failed.'));
}

function handleWorkerStdout(workerState: ImageAnalysisWorker, chunk: Buffer) {
  workerState.stdoutBuffer += String(chunk);
  const lines = workerState.stdoutBuffer.split(/\r?\n/);
  workerState.stdoutBuffer = lines.pop() ?? '';
  lines.forEach((line) => parseWorkerLine(workerState, line));
}

function createWorker() {
  const child = spawn(
    serverConfig.aiImageAnalysisPythonCommand,
    [...serverConfig.aiImageAnalysisPythonArgs, sidecarScriptPath, '--worker'],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  const workerState: ImageAnalysisWorker = {
    child,
    pending: new Map(),
    nextId: 1,
    stderr: [],
    stdoutBuffer: '',
  };
  child.stdout.on('data', (chunk) => handleWorkerStdout(workerState, chunk));
  child.stderr.on('data', (chunk) => workerState.stderr.push(String(chunk)));
  child.once('error', (error) => {
    worker = null;
    rejectPending(workerState, new HttpError(503, `Unable to start the local image-analysis worker: ${error.message}`));
  });
  child.once('close', (code) => {
    worker = null;
    rejectPending(
      workerState,
      new HttpError(503, workerState.stderr.join('').trim() || `The local image-analysis worker exited with code ${code}.`),
    );
  });
  worker = workerState;
  return workerState;
}

function getWorker() {
  return worker && !worker.child.killed ? worker : createWorker();
}

function requestWorkerAnalysis(filePath: string, options: ImageAnalysisSidecarOptions = {}) {
  const workerState = getWorker();
  const id = String(workerState.nextId++);
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      workerState.pending.delete(id);
      workerState.child.kill();
      if (worker === workerState) {
        worker = null;
      }
      reject(new HttpError(504, `The local image-analysis worker timed out after ${IMAGE_TOOL_ATTEMPT_TIMEOUT_MS}ms.`));
    }, Math.min(serverConfig.aiImageAnalysisTimeoutMs, IMAGE_TOOL_ATTEMPT_TIMEOUT_MS));
    workerState.pending.set(id, { resolve, reject, timeoutId });
    const onAbort = () => {
      workerState.pending.delete(id);
      clearTimeout(timeoutId);
      workerState.child.kill();
      if (worker === workerState) {
        worker = null;
      }
      reject(options.signal?.reason instanceof Error ? options.signal.reason : new DOMException('The request was aborted.', 'AbortError'));
    };
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener('abort', onAbort, { once: true });
    workerState.child.stdin.write(`${JSON.stringify({ id, filePath })}\n`, (error) => {
      if (!error) {
        return;
      }
      workerState.pending.delete(id);
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onAbort);
      reject(new HttpError(503, `Unable to write to the local image-analysis worker: ${error.message}`));
    });
  });
}

export async function analyzeImageWithSidecar(filePath: string, options: ImageAnalysisSidecarOptions = {}): Promise<ImageAnalysisSidecarResult> {
  options.telemetry?.log('scene_parsing_started', { provider: 'local', model: 'python-sidecar' });
  const raw = runSidecarHook ? await runSidecar(['--analyze', filePath]) : await requestWorkerAnalysis(filePath, options);
  options.telemetry?.log('image_loaded', { provider: 'local', model: 'python-sidecar' });
  options.telemetry?.log('response_parsing_started', { provider: 'local', model: 'python-sidecar' });
  let payload: { debugImages?: Record<string, string>; sceneGraph?: unknown };
  try {
    payload = JSON.parse(raw) as { debugImages?: Record<string, string>; sceneGraph?: unknown };
  } catch {
    throw new HttpError(502, 'The local image-analysis sidecar returned invalid JSON.');
  }
  options.telemetry?.log('response_parsing_completed', { provider: 'local', model: 'python-sidecar' });
  if (!payload.sceneGraph) {
    throw new HttpError(502, 'The local image-analysis sidecar did not return a scene graph.');
  }
  options.telemetry?.log('scene_parsing_completed', { provider: 'local', model: 'python-sidecar' });

  return {
    sceneGraph: parseAiImageSceneGraph(normalizeSceneGraphForSidecar(payload.sceneGraph), 'Image analysis sidecar scene graph'),
    debugImages: Object.fromEntries(
      Object.entries(payload.debugImages ?? {}).map(([name, base64Data]) => [name, Buffer.from(base64Data, 'base64')]),
    ),
  };
}

export function setImageAnalysisSidecarHookForTests(hook: typeof runSidecarHook) {
  runSidecarHook = hook;
}
