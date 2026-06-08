import { startAppServerProcess } from './bootstrap/app-server';
import { createLogger } from './bootstrap/log';
import { ensureSearxng } from './bootstrap/searxng';

const logger = createLogger('dev');

async function main() {
  await ensureSearxng(logger);
  await startAppServerProcess(logger);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unable to start the dev environment.';
  logger.error(message);
  process.exit(1);
});
