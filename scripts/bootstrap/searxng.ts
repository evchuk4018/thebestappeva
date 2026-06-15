import { access } from 'node:fs/promises';
import { serverConfig } from '../../server/config';
import { isCommandAvailable, runCommand, spawnDetachedCommand } from './process';
import { createSearxngBootstrap } from './searxng-bootstrap';
import { waitForCondition } from './wait';

export const { ensureSearxng } = createSearxngBootstrap({
  fetch: globalThis.fetch,
  fileExists: async (path) => {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  isCommandAvailable,
  platform: process.platform,
  runCommand,
  spawnDetachedCommand,
  waitForCondition,
}, {
  searxngBaseUrl: serverConfig.searxngBaseUrl,
});
