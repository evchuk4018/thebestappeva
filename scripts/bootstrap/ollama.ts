import type { BootstrapLogger } from './log';
import {
  isCommandAvailable,
  runStreamingCommand,
  spawnDetachedCommand,
} from './process';
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

function buildMissingOllamaMessage() {
  return `Ollama is unavailable. Install Ollama, or start \`ollama serve\` manually so ${ollamaBaseUrl} is reachable.`;
}

async function waitForOllama() {
  return waitForCondition(isOllamaReady, {
    timeoutMs: ollamaStartupTimeoutMs,
    intervalMs: ollamaPollIntervalMs,
  });
}

export async function ensureOllamaModel(logger: BootstrapLogger, modelName: string) {
  logger.step(`Checking Ollama at ${ollamaBaseUrl}...`);

  if (!(await isOllamaReady().catch(() => false))) {
    logger.step('Ollama is not running. Attempting to start `ollama serve`...');

    if (!(await isCommandAvailable('ollama'))) {
      throw new Error(buildMissingOllamaMessage());
    }

    await spawnDetachedCommand('ollama', ['serve']);
    if (!(await waitForOllama())) {
      throw new Error(`Ollama did not become ready within ${ollamaStartupTimeoutMs}ms at ${ollamaBaseUrl}.`);
    }
  }

  logger.step('Ollama is ready.');
  const installedModels = await listInstalledModels();
  if (installedModels.has(modelName)) {
    logger.step(`${modelName} is already installed.`);
    return;
  }

  logger.step(`Pulling ${modelName} from Ollama...`);
  if (!(await isCommandAvailable('ollama'))) {
    throw new Error(`The ${modelName} model is missing and the Ollama CLI is unavailable. ${buildMissingOllamaMessage()}`);
  }

  await runStreamingCommand('ollama', ['pull', modelName]);
  logger.step(`${modelName} is installed.`);
}
