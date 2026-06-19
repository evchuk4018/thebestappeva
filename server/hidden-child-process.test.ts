import assert from 'node:assert/strict';
import test from 'node:test';
import { withHiddenWindows } from './hidden-child-process';

test('withHiddenWindows hides Windows consoles while preserving spawn options', () => {
  const options = withHiddenWindows({
    cwd: 'workspace',
    stdio: ['ignore', 'pipe', 'pipe'] as const,
  });

  assert.equal(options.windowsHide, true);
  assert.equal(options.cwd, 'workspace');
  assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
});
