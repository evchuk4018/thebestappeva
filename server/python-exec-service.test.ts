import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { HttpError } from './http';
import { parsePythonExecRequest, runPythonExecProcess, runPythonExecRequest } from './python-exec-service';

test('parses a valid python exec request', () => {
  const request = parsePythonExecRequest({ code: 'print("hello")', files: ['README.md'] });

  assert.equal(request.code, 'print("hello")');
  assert.deepEqual(request.files, ['README.md']);
});

test('rejects path traversal and excluded roots', async () => {
  await assert.rejects(
    () => runPythonExecRequest({ code: 'print("x")', files: ['../secret.txt'] }),
    /must stay inside the repo root/i,
  );
  await assert.rejects(
    () => runPythonExecRequest({ code: 'print("x")', files: ['node_modules/pkg/index.js'] }),
    /cannot stage files from "node_modules"/i,
  );
});

test('returns structured execution payloads with staged file metadata', async () => {
  const result = await runPythonExecRequest(
    { code: 'print("hello")', files: ['README.md'] },
    {
      runProcess: async ({ stdin }) => {
        const payload = JSON.parse(stdin) as { stagedFiles: Array<{ requestedPath: string; sandboxPath: string; sizeBytes: number }> };
        return {
          stderr: '',
          stdout: JSON.stringify({
            exitCode: 0,
            stdout: 'hello\n',
            stderr: '',
            durationMs: 8,
            stagedFiles: payload.stagedFiles,
            generatedFiles: [],
            stdoutTruncated: false,
            stderrTruncated: false,
          }),
        };
      },
    },
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'hello\n');
  assert.equal(result.stagedFiles[0]?.requestedPath, 'README.md');
});

test('surfaces controlled timeout failures', async () => {
  await assert.rejects(
    () => runPythonExecRequest({ code: 'print("slow")' }, {
      runProcess: async () => {
        throw new HttpError(504, 'The local Python sandbox timed out after 1ms.');
      },
    }),
    /timed out/i,
  );
});

test('actual python sandbox truncates oversized stdout when Python is available', async (t) => {
  const check = spawnSync('py', ['-3', '--version'], { encoding: 'utf8' });
  if (check.status !== 0) {
    t.skip('Python launcher is unavailable.');
    return;
  }

  const result = await runPythonExecRequest({
    code: 'print("x" * 20000)',
  }, {
    runProcess: ({ args, command, stdin, timeoutMs }) => runPythonExecProcess({ args, command, stdin, timeoutMs }),
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.stdoutTruncated, true);
  assert(result.stdout.length < 20000);
});
