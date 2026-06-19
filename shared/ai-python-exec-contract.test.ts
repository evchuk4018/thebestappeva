import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  PythonExecGeneratedFile,
  PythonExecRequest,
  PythonExecResponse,
} from './ai-python-exec-contract';

test('python exec request carries an optional chat id', () => {
  const request: PythonExecRequest = { code: 'print(1)', chatId: 'chat-1' };
  assert.equal(request.chatId, 'chat-1');

  const bare: PythonExecRequest = { code: 'print(1)' };
  assert.equal(bare.chatId, undefined);
});

test('generated files describe images, text, and downloads', () => {
  const file: PythonExecGeneratedFile = {
    path: 'work/chart.png',
    sizeBytes: 1024,
    preview: '',
    truncated: false,
    kind: 'image',
    mediaType: 'image/png',
    downloadUrl: '/api/ai/chats/chat-1/python-exec/files/work/chart.png',
  };
  assert.equal(file.kind, 'image');
  assert.equal(file.mediaType, 'image/png');
  assert.match(file.downloadUrl ?? '', /\/python-exec\/files\//);
});

test('python exec responses expose session status and chat id', () => {
  const response: PythonExecResponse = {
    chatId: 'chat-1',
    sessionStatus: 'fallback',
    durationMs: 12,
    exitCode: 0,
    generatedFiles: [],
    stagedFiles: [],
    stderr: '',
    stderrTruncated: false,
    stdout: 'ok\n',
    stdoutTruncated: false,
  };
  assert.equal(response.sessionStatus, 'fallback');
  assert.equal(response.chatId, 'chat-1');
});
