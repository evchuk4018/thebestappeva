import assert from 'node:assert/strict';
import test from 'node:test';
import { toPersistedToolInvocation } from './trace-persistence';

test('redacts python exec code while preserving real args for replay', () => {
  const invocation = toPersistedToolInvocation({
    toolId: 'python.exec',
    functionName: 'python_exec',
    args: {
      code: 'print("hidden")',
      files: ['README.md'],
    },
    createdAt: '2026-06-13T00:00:00.000Z',
    toolCallId: 'tool-1',
  });

  assert.equal(invocation.args.code, 'print("hidden")');
  assert.equal(invocation.displayArgs?.code, '[Private Python code hidden. Use View Python.]');
  assert.deepEqual(invocation.displayArgs?.files, ['README.md']);
});

test('leaves non-python tool invocations unchanged', () => {
  const invocation = {
    toolId: 'weather',
    functionName: 'get_weather',
    args: { query: 'Boston' },
    createdAt: '2026-06-13T00:00:00.000Z',
  };

  assert.equal(toPersistedToolInvocation(invocation), invocation);
});
