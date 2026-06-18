import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runChatPythonExecRequest } from './python-exec-chat';
import type { PythonExecBackend, PythonExecRawResult, PythonExecExecOptions, PythonExecSession } from './python-exec-backend';
import { PythonExecSessionManager } from './python-exec-sessions';
import { ensureChatWorkspace, detectFileKind, validateWorkspaceRelativePath } from './python-exec-paths';
import { HttpError } from './http';

interface FakeBackendSession extends PythonExecSession {
  chatId: string;
  workDir: string;
  namespace: Record<string, unknown>;
  execCalls: number;
}

function createFakeBackend(): { backend: PythonExecBackend; sessions: Map<string, FakeBackendSession> } {
  const sessions = new Map<string, FakeBackendSession>();
  const backend: PythonExecBackend = {
    available: true,
    async openSession(chatId, workDir): Promise<PythonExecSession> {
      const session: FakeBackendSession = {
        chatId,
        workDir,
        namespace: { __name__: '__main__' },
        execCalls: 0,
        get alive() {
          return true;
        },
        async exec(code, options: PythonExecExecOptions): Promise<PythonExecRawResult> {
          session.execCalls += 1;
          if (code.includes('STORE')) {
            session.namespace['value'] = 42;
            return { ok: true, exitCode: 0, stdout: 'stored', stderr: '', durationMs: 1, stdoutTruncated: false, stderrTruncated: false };
          }
          if (code.includes('READ')) {
            const value = session.namespace['value'];
            return { ok: true, exitCode: 0, stdout: String(value ?? 'none'), stderr: '', durationMs: 1, stdoutTruncated: false, stderrTruncated: false };
          }
          if (code.includes('WRITE_FILE')) {
            await fs.writeFile(path.join(workDir, 'chart.png'), 'PNGDATA');
            await fs.writeFile(path.join(workDir, 'data.csv'), 'a,b\n1,2\n3,4\n');
            return { ok: true, exitCode: 0, stdout: 'written', stderr: '', durationMs: 1, stdoutTruncated: false, stderrTruncated: false };
          }
          if (code.includes('TIMEOUT')) {
            return { ok: false, exitCode: 1, stdout: '', stderr: '', durationMs: options.timeoutMs, stdoutTruncated: false, stderrTruncated: false, error: `timeout_${options.timeoutMs}` };
          }
          if (code.includes('ABORT')) {
            return { ok: false, exitCode: 1, stdout: '', stderr: '', durationMs: 0, stdoutTruncated: false, stderrTruncated: false, error: 'aborted' };
          }
          return { ok: true, exitCode: 0, stdout: 'ok', stderr: '', durationMs: 1, stdoutTruncated: false, stderrTruncated: false };
        },
        async reset() {
          session.namespace = { __name__: '__main__' };
        },
        async kill() {},
      };
      sessions.set(chatId, session);
      return session;
    },
  };
  return { backend, sessions };
}

async function withTempRoot<T>(fn: (root: string) => Promise<T>): Promise<T> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'python-exec-chat-'));
  try {
    return await fn(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}

test('variables persist across calls in the same chat', async () => {
  await withTempRoot(async (workspaceRoot) => {
    const { backend } = createFakeBackend();
    const sessionManager = new PythonExecSessionManager({ backend, idleMs: 100000 });
    await runChatPythonExecRequest({ code: 'STORE', chatId: 'chat-1' }, { backend, sessionManager, workspaceRoot });
    const second = await runChatPythonExecRequest({ code: 'READ', chatId: 'chat-1' }, { backend, sessionManager, workspaceRoot });
    assert.equal(second.stdout, '42');
    assert.equal(second.sessionStatus, 'ready');
  });
});

test('generated files are classified and given download urls', async () => {
  await withTempRoot(async (workspaceRoot) => {
    const { backend } = createFakeBackend();
    const sessionManager = new PythonExecSessionManager({ backend, idleMs: 100000 });
    const result = await runChatPythonExecRequest({ code: 'WRITE_FILE', chatId: 'chat-2' }, { backend, sessionManager, workspaceRoot });
    const png = result.generatedFiles.find((file) => file.path === 'chart.png');
    const csv = result.generatedFiles.find((file) => file.path === 'data.csv');
    assert.equal(png?.kind, 'image');
    assert.equal(png?.mediaType, 'image/png');
    assert.match(png?.downloadUrl ?? '', /\/api\/ai\/chats\/chat-2\/python-exec\/files\/chart\.png/);
    assert.equal(csv?.kind, 'text');
    assert.equal(csv?.mediaType, 'text/csv');
    assert.ok(csv?.preview.includes('a,b'));
  });
});

test('path traversal in requested files is rejected', async () => {
  await withTempRoot(async (workspaceRoot) => {
    const { backend } = createFakeBackend();
    const sessionManager = new PythonExecSessionManager({ backend, idleMs: 100000 });
    await assert.rejects(
      () => runChatPythonExecRequest({ code: 'print(1)', chatId: 'chat-3', files: ['../secret.txt'] }, { backend, sessionManager, workspaceRoot }),
      /must stay inside the repo root/i,
    );
  });
});

test('timeout responses surface as 504', async () => {
  await withTempRoot(async (workspaceRoot) => {
    const { backend } = createFakeBackend();
    const sessionManager = new PythonExecSessionManager({ backend, idleMs: 100000 });
    await assert.rejects(
      () => runChatPythonExecRequest({ code: 'TIMEOUT', chatId: 'chat-4' }, { backend, sessionManager, workspaceRoot }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 504,
    );
  });
});

test('abort responses surface as 499', async () => {
  await withTempRoot(async (workspaceRoot) => {
    const { backend } = createFakeBackend();
    const sessionManager = new PythonExecSessionManager({ backend, idleMs: 100000 });
    await assert.rejects(
      () => runChatPythonExecRequest({ code: 'ABORT', chatId: 'chat-5' }, { backend, sessionManager, workspaceRoot }),
      (error: unknown) => error instanceof HttpError && error.statusCode === 499,
    );
  });
});

test('each chat workspace is isolated on disk', async () => {
  await withTempRoot(async (workspaceRoot) => {
    const { root: aRoot } = await ensureChatWorkspace(workspaceRoot, 'iso-a');
    const { root: bRoot } = await ensureChatWorkspace(workspaceRoot, 'iso-b');
    assert.notEqual(aRoot, bRoot);
    assert.equal(detectFileKind('chart.png'), 'image');
    assert.equal(detectFileKind('notes.txt'), 'text');
    assert.equal(detectFileKind('report.pdf'), 'binary');
    const resolved = validateWorkspaceRelativePath(workspaceRoot, 'iso-a', 'chart.png');
    assert.equal(path.dirname(path.dirname(resolved)), path.resolve(workspaceRoot, 'iso-a'));
    assert.throws(
      () => validateWorkspaceRelativePath(workspaceRoot, 'iso-a', '../iso-b/secret.txt'),
      /must stay inside the chat workspace/i,
    );
  });
});