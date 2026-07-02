import assert from 'node:assert/strict';
import test from 'node:test';
import { appConfig, getAppConfig, resetAppConfigForTests, setAppConfigForTests } from './app-config';

test.afterEach(() => {
  resetAppConfigForTests();
});

test('app config defaults to same-origin API mode', () => {
  assert.deepEqual(getAppConfig(), { apiMode: 'offline', apiBaseUrl: '/api' });
  assert.equal(appConfig.apiMode, 'offline');
  assert.equal(appConfig.apiBaseUrl, '/api');
});

test('app config exposes test overrides without localStorage', () => {
  setAppConfigForTests({ apiBaseUrl: 'https://example.com/api' });
  assert.deepEqual(getAppConfig(), { apiMode: 'online', apiBaseUrl: 'https://example.com/api' });

  setAppConfigForTests({ apiMode: 'offline', apiBaseUrl: '/api' });
  assert.deepEqual(getAppConfig(), { apiMode: 'offline', apiBaseUrl: '/api' });
});
