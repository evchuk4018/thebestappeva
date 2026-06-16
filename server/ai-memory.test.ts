import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import type { Request, Response } from 'express';
import { handlePostAiMemoryRefresh } from './ai-memory';

function createResponseRecorder() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

test('memory refresh route aborts the in-flight service call when the client disconnects', async () => {
  const request = new EventEmitter() as Request;
  request.params = { chatId: 'chat-1' };
  const response = createResponseRecorder() as unknown as Response;
  let sawAbort = false;
  const service = {
    refreshChatMemory: async (_chatId: string, options: { signal?: AbortSignal } = {}) => {
      return await new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          sawAbort = true;
          reject(options.signal?.reason);
        }, { once: true });
      });
    },
  };

  const pending = handlePostAiMemoryRefresh(request, response, service);
  request.emit('close');
  await pending;

  assert.equal(sawAbort, true);
  assert.equal((response as unknown as ReturnType<typeof createResponseRecorder>).payload, undefined);
});
