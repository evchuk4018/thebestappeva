import assert from 'node:assert/strict';
import test from 'node:test';
import { WORK_STATUS_MESSAGES, pickWorkStatusMessage } from './work-status-messages';

test('pickWorkStatusMessage always returns an approved message', () => {
  for (let i = 0; i < 100; i += 1) {
    const message = pickWorkStatusMessage();
    assert.ok(WORK_STATUS_MESSAGES.includes(message), `unexpected message: ${message}`);
  }
});

test('WORK_STATUS_MESSAGES is non-empty and unique', () => {
  assert.ok(WORK_STATUS_MESSAGES.length > 0);
  assert.equal(new Set(WORK_STATUS_MESSAGES).size, WORK_STATUS_MESSAGES.length);
});