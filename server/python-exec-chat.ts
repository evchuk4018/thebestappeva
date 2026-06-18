import { serverConfig } from './config';
import { HttpError } from './http';
import type { PythonExecBackend, PythonExecRawResult } from './python-exec-backend';
import {
  collectGeneratedFiles,
  ensureChatWorkspace,
  stageRequestedFiles,
} from './python-exec-paths';
import type { PythonExecRequest, PythonExecResponse } from '../shared/ai-python-exec-contract';
import { PythonExecSessionManager } from './python-exec-sessions';

export interface PythonExecChatOptions {
  projectRoot?: string;
  workspaceRoot?: string;
  backend: PythonExecBackend;
  sessionManager?: PythonExecSessionManager;
  signal?: AbortSignal;
}

export async function runChatPythonExecRequest(
  request: PythonExecRequest & { chatId: string },
  options: PythonExecChatOptions,
): Promise<PythonExecResponse> {
  const chatId = request.chatId;
  const projectRoot = options.projectRoot ?? process.cwd();
  const workspaceRoot = options.workspaceRoot ?? serverConfig.aiPythonExecWorkspaceRoot;
  const sessionManager = options.sessionManager ?? new PythonExecSessionManager({ backend: options.backend });

  const { inputs, work } = await ensureChatWorkspace(workspaceRoot, chatId);
  const stagedFiles = await stageRequestedFiles(projectRoot, request.files ?? [], inputs);

  const { session, recovered } = await sessionManager.acquire(chatId, work, inputs);
  if (recovered) {
    await session.reset().catch(() => undefined);
  }

  const outputCharLimit = serverConfig.aiPythonExecMaxOutputChars;
  const previewLimit = Math.max(120, Math.min(2000, Math.floor(outputCharLimit / 4)));
  const maxGeneratedFiles = Math.max(1, serverConfig.aiPythonExecMaxFiles * 4);

  let raw: PythonExecRawResult;
  try {
    raw = await session.exec(request.code, {
      outputCharLimit,
      timeoutMs: serverConfig.aiPythonExecTimeoutMs,
      signal: options.signal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Python sandbox failed.';
    throw new HttpError(503, message);
  }

  if (!raw.ok && raw.error === 'aborted') {
    throw new HttpError(499, 'The Python execution was cancelled.');
  }
  if (!raw.ok && raw.error?.startsWith('timeout_')) {
    throw new HttpError(504, `The local Python sandbox timed out after ${serverConfig.aiPythonExecTimeoutMs}ms.`);
  }
  if (!raw.ok && raw.error) {
    throw new HttpError(502, raw.error);
  }

  const generatedFiles = await collectGeneratedFiles(work, previewLimit, maxGeneratedFiles, chatId);

  return {
    chatId,
    durationMs: raw.durationMs,
    exitCode: raw.exitCode,
    stdout: raw.stdout,
    stderr: raw.stderr,
    stdoutTruncated: raw.stdoutTruncated,
    stderrTruncated: raw.stderrTruncated,
    stagedFiles,
    generatedFiles,
    sessionStatus: recovered ? 'recovered' : 'ready',
  };
}