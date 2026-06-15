import type { BootstrapLogger } from './log';
import { runStreamingCommand, spawnDetachedCommand } from './process';
import { ensureOllamaCommand } from './ollama-cli';
import { waitForCondition } from './wait';

const ollamaBaseUrl = 'http://127.0.0.1:11434';
const ollamaStartupTimeoutMs = 15000;
const ollamaPollIntervalMs = 1000;

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
  }>;
}

async function isOllamaReady() {
  const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
    signal: AbortSignal.timeout(3000),
  });

  return response.ok;
}

async function listInstalledModels() {
  const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  return new Set(
    (payload.models ?? [])
      .map((model) => model.name?.trim())
      .filter((name): name is string => Boolean(name)),
  );
}

async function waitForOllama() {
  return waitForCondition(isOllamaReady, {
    timeoutMs: ollamaStartupTimeoutMs,
    intervalMs: ollamaPollIntervalMs,
  });
}

export async function ensureOllamaRuntime(logger: BootstrapLogger) {
  const ollamaCommand = await ensureOllamaCommand(logger);
  logger.step(`Checking Ollama at ${ollamaBaseUrl}...`);

  if (!(await isOllamaReady().catch(() => false))) {
    logger.step('Ollama is not running. Attempting to start `ollama serve`...');

    await spawnDetachedCommand(ollamaCommand, ['serve']);
    if (!(await waitForOllama())) {
      throw new Error(`Ollama did not become ready within ${ollamaStartupTimeoutMs}ms at ${ollamaBaseUrl}.`);
    }
  }

  logger.step('Ollama is ready.');
  return ollamaCommand;
}

export async function ensureOllamaModel(logger: BootstrapLogger, modelName: string) {
  const ollamaCommand = await ensureOllamaRuntime(logger);
  const installedModels = await listInstalledModels();
  if (installedModels.has(modelName)) {
    logger.step(`${modelName} is already installed.`);
    return;
  }

  logger.step(`Pulling ${modelName} from Ollama...`);
  await runStreamingCommand(ollamaCommand, ['pull', modelName]);
  logger.step(`${modelName} is installed.`);
}
