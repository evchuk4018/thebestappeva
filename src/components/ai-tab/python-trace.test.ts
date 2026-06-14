import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPythonTraceInspection } from './python-trace';

test('builds a combined python trace inspection from persisted tool call and result steps', () => {
  const inspection = buildPythonTraceInspection([
    {
      id: 'trace-1',
      kind: 'tool-call',
      createdAt: '2026-06-13T00:00:00.000Z',
      invocation: {
        toolId: 'python.exec',
        functionName: 'python_exec',
        args: { code: 'print("hello")', files: ['README.md'] },
        displayArgs: { code: '[Private Python code hidden. Use View Python.]', files: ['README.md'] },
        createdAt: '2026-06-13T00:00:00.000Z',
        toolCallId: 'tool-1',
      },
    },
    {
      id: 'trace-2',
      kind: 'tool-result',
      createdAt: '2026-06-13T00:00:01.000Z',
      result: {
        toolId: 'python.exec',
        functionName: 'python_exec',
        ok: true,
        summary: 'Python ran successfully in 10ms.',
        data: {
          exitCode: 0,
          stdout: 'hello\n',
          stderr: '',
          durationMs: 10,
          stagedFiles: [{ requestedPath: 'README.md', sandboxPath: 'inputs/README.md', sizeBytes: 42 }],
          generatedFiles: [{ path: 'work/out.txt', sizeBytes: 5, preview: 'hello', truncated: false }],
        },
        toolCallId: 'tool-1',
      },
    },
  ], 1);

  assert.equal(inspection?.code, 'print("hello")');
  assert.deepEqual(inspection?.requestedFiles, ['README.md']);
  assert.equal(inspection?.stdout, 'hello\n');
  assert.equal(inspection?.generatedFiles[0]?.path, 'work/out.txt');
});
