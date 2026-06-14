import assert from 'node:assert/strict';
import test from 'node:test';
import { getToolRegistryEntries } from './registry';
import { pythonExecTool } from './python-exec-tool';

test('python exec is registered as a visible local tool', () => {
  const entry = getToolRegistryEntries().find((candidate) => candidate.definition.id === 'python.exec');

  assert.equal(entry?.definition.label, 'Python Exec');
  assert.equal(entry?.definition.alias, '/python.exec');
  assert.equal(entry?.definition.functions[0]?.name, 'python_exec');
});

test('python exec dispatches through the standard executor shape', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  Object.assign(globalThis, {
    window: {
      location: { origin: 'http://localhost:3000' },
    },
  });
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      exitCode: 0,
      stdout: 'hello\n',
      stderr: '',
      durationMs: 12,
      stagedFiles: [],
      generatedFiles: [],
      stdoutTruncated: false,
      stderrTruncated: false,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const result = await pythonExecTool.execute({
      toolId: 'python.exec',
      functionName: 'python_exec',
      args: { code: 'print("hello")' },
      createdAt: '2026-06-13T00:00:00.000Z',
    }, {});

    assert.equal('deferred' in result, false);
    if ('deferred' in result) {
      throw new Error('python exec should not defer');
    }
    assert.equal(result.ok, true);
    assert.match(result.summary, /Python ran successfully/i);
    assert.equal(result.data?.stdout, 'hello\n');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete (globalThis as typeof globalThis & { window?: Window }).window;
    } else {
      Object.assign(globalThis, { window: originalWindow });
    }
  }
});
