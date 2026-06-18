import { startAppServerProcess } from './bootstrap/app-server';
import { createLogger } from './bootstrap/log';
import { ensureOllamaRuntime } from './bootstrap/ollama';
import { ensurePythonExecRuntime } from './bootstrap/python-exec';
import { ensureSearxng } from './bootstrap/searxng';

const logger = createLogger('dev');

async function main() {
  await ensureSearxng(logger);
  await ensureOllamaRuntime(logger).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unable to bootstrap Ollama.';
    logger.warn(`${message} Continuing without guaranteed local AI availability.`);
  });
  await ensurePythonExecRuntime(logger).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unable to bootstrap the python.exec sandbox.';
    logger.warn(`${message} Continuing without persistent python.exec sessions.`);
  });
  await startAppServerProcess(logger);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unable to start the dev environment.';
  logger.error(message);
  process.exit(1);
});
