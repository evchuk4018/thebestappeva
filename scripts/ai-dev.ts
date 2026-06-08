import { startAppServerProcess } from './bootstrap/app-server';
import { createLogger } from './bootstrap/log';
import { ensureOllamaModel } from './bootstrap/ollama';
import { ensureSearxng } from './bootstrap/searxng';

const logger = createLogger('ai:dev');
const requiredModel = 'qwen3.5:9b';

async function main() {
  await ensureOllamaModel(logger, requiredModel);
  await ensureSearxng(logger, true);
  await startAppServerProcess(logger);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unable to start the AI-ready dev environment.';
  logger.error(message);
  process.exit(1);
});
