import fs from 'node:fs/promises';
import type { Request, Response } from 'express';
import { serverConfig } from './config';
import { HttpError } from './http';
import { DockerPythonExecBackend } from './python-exec-backend';
import { runChatPythonExecRequest } from './python-exec-chat';
import { validateWorkspaceRelativePath, detectMediaType } from './python-exec-paths';
import { parsePythonExecRequest, runPythonExecRequest } from './python-exec-service';
import { getDefaultSessionManager } from './python-exec-sessions';

const dockerBackend = new DockerPythonExecBackend();

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

export async function handlePythonExec(request: Request, response: Response) {
  try {
    const parsed = parsePythonExecRequest(request.body);
    if (parsed.chatId && dockerBackend.available) {
      const sessionManager = getDefaultSessionManager(dockerBackend);
      response.status(200).json(await runChatPythonExecRequest({ ...parsed, chatId: parsed.chatId }, { backend: dockerBackend, sessionManager }));
      return;
    }
    response.status(200).json(await runPythonExecRequest(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Python execution failed.';
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
    response.status(200).set('Content-Type', mediaType).set('Content-Length', stat.size.toString());
    const stream = await fs.open(absolutePath, 'r');
    stream.createReadStream().pipe(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to download the generated file.';
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    response.status(statusCode).json({ ok: false, error: message });
  }
}