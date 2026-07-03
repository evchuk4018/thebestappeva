import fs from 'node:fs/promises';
import path from 'node:path';
import type { Request, Response } from 'express';
import { serverConfig } from './config';
import { HttpError } from './http';
import { DockerPythonExecBackend, type PythonExecBackend } from './python-exec-backend';
import { runChatPythonExecRequest } from './python-exec-chat';
import { validateWorkspaceRelativePath, detectMediaType } from './python-exec-paths';
import { parsePythonExecRequest, runPythonExecChatFallback, runPythonExecRequest } from './python-exec-service';
import { getDefaultSessionManager, type PythonExecSessionManager } from './python-exec-sessions';
import type { PythonExecRequest, PythonExecResponse } from '../shared/ai-python-exec-contract';

const dockerBackend = new DockerPythonExecBackend();

interface PythonExecRunOptions {
  backend?: PythonExecBackend;
  sessionManager?: PythonExecSessionManager;
  runFallback?: (request: PythonExecRequest & { chatId: string }) => Promise<PythonExecResponse>;
}

function resolveChatId(request: Request): string | undefined {
  const bodyChatId = (request.body as { chatId?: unknown } | undefined)?.chatId;
  if (typeof bodyChatId === 'string' && bodyChatId.trim()) {
    return bodyChatId.trim();
  }
  if (typeof request.params.chatId === 'string' && request.params.chatId.trim()) {
    return request.params.chatId.trim();
  }
  return undefined;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function shouldFallbackFromPersistentError(error: unknown) {
  if (!(error instanceof HttpError)) {
    return false;
  }
  if (error.statusCode === 503) {
    return true;
  }
  return error.statusCode === 502 && /sandbox (exited unexpectedly|is not running|did not become ready)|unable to start/i.test(error.message);
}

function buildCombinedRuntimeError(persistentError: unknown, fallbackError: unknown) {
  const statusCode = fallbackError instanceof HttpError ? fallbackError.statusCode : 503;
  const persistentMessage = errorMessage(persistentError, 'The persistent Python sandbox failed.');
  const fallbackMessage = errorMessage(fallbackError, 'The one-shot Python sandbox failed.');
  return new HttpError(
    statusCode,
    `Persistent Python sandbox failed: ${persistentMessage} One-shot Python sandbox also failed: ${fallbackMessage}`,
  );
}

export async function runPythonExecWithFallback(
  parsed: PythonExecRequest,
  options: PythonExecRunOptions = {},
) {
  const backend = options.backend ?? dockerBackend;
  if (parsed.chatId) {
    if (backend.available) {
      const sessionManager = options.sessionManager ?? getDefaultSessionManager(backend);
      try {
        return await runChatPythonExecRequest({ ...parsed, chatId: parsed.chatId }, { backend, sessionManager });
      } catch (error) {
        if (!shouldFallbackFromPersistentError(error)) {
          throw error;
        }
        await sessionManager.evict(parsed.chatId).catch(() => undefined);
        try {
          return await (options.runFallback ?? runPythonExecChatFallback)({ ...parsed, chatId: parsed.chatId });
        } catch (fallbackError) {
          throw buildCombinedRuntimeError(error, fallbackError);
        }
      }
    }
    return (options.runFallback ?? runPythonExecChatFallback)({ ...parsed, chatId: parsed.chatId });
  }
  return runPythonExecRequest(parsed);
}

export async function handlePythonExec(request: Request, response: Response) {
  try {
    const parsed = parsePythonExecRequest(request.body);
    response.status(200).json(await runPythonExecWithFallback(parsed));
  } catch (error) {
    const message = errorMessage(error, 'Python execution failed.');
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    response.status(statusCode).json({ ok: false, error: message });
  }
}

export async function handlePythonExecFileDownload(request: Request, response: Response) {
  try {
    const chatId = resolveChatId(request);
    if (!chatId) {
      throw new HttpError(400, 'A chat id is required to download generated files.');
    }
    const relativePath = request.params[0] as string | undefined;
    if (!relativePath) {
      throw new HttpError(400, 'A generated file path is required.');
    }
    const absolutePath = validateWorkspaceRelativePath(serverConfig.aiPythonExecWorkspaceRoot, chatId, relativePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
      throw new HttpError(404, 'The requested generated file was not found.');
    }
    const mediaType = detectMediaType(relativePath) ?? 'application/octet-stream';
    const fileName = path.posix.basename(relativePath);
    response
      .status(200)
      .set('Content-Type', mediaType)
      .set('Content-Length', stat.size.toString())
      .set('Content-Disposition', `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    const stream = await fs.open(absolutePath, 'r');
    stream.createReadStream().pipe(response);
  } catch (error) {
    const message = errorMessage(error, 'Unable to download the generated file.');
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    response.status(statusCode).json({ ok: false, error: message });
  }
}
