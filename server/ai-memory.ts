import type { Request, Response } from 'express';
import { getRequestAuthContext } from './auth/request-context';
import { createAiMemoryService } from './ai-memory-service';
import { createPostgresAiWorkspaceRepository } from './db/postgres-ai-workspace-repository';
import { getOwnerUuidFromRequestContext } from './db/postgres-repository-utils';
import { HttpError } from './http';

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function createRequestAbortController(request: Request) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException('The client disconnected.', 'AbortError'));
    }
  };

  request.once('aborted', abort);
  request.once('close', abort);

  return {
    controller,
    cleanup() {
      request.off('aborted', abort);
      request.off('close', abort);
    },
  };
}

export async function handlePostAiMemoryRefresh(
  request: Request,
  response: Response,
  service = createAiMemoryService(createPostgresAiWorkspaceRepository(getOwnerUuidFromRequestContext(getRequestAuthContext(request).userId))),
) {
  const chatId = typeof request.params.chatId === 'string' ? request.params.chatId.trim() : '';
  const { controller, cleanup } = createRequestAbortController(request);

  try {
    const payload = await service.refreshChatMemory(chatId, { signal: controller.signal });
    if (!controller.signal.aborted) {
      response.status(200).json(payload);
    }
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to refresh chat memory.';
    response.status(error instanceof HttpError ? error.statusCode : 500).json({ ok: false, error: message });
  } finally {
    cleanup();
  }
}
