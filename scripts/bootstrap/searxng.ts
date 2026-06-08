import { serverConfig } from '../../server/config';
import type { BootstrapLogger } from './log';
import { isCommandAvailable, runCommand } from './process';
import { waitForCondition } from './wait';

const dockerComposeArgs = ['compose', '-f', 'docker-compose.searxng.yml'];
const startupTimeoutMs = 15000;
const pollIntervalMs = 1200;

async function startSearxngContainer() {
  await runCommand('docker', [...dockerComposeArgs, 'up', '-d']);
}

async function isSearxngReady() {
  const searchUrl = new URL('/search', `${serverConfig.searxngBaseUrl}/`);
  searchUrl.searchParams.set('q', 'healthcheck');
  searchUrl.searchParams.set('format', 'json');

  const response = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(3000),
  });

  return response.ok;
}

function buildRequiredDockerMessage() {
  return `Docker is unavailable. Install Docker Desktop and start SearXNG with \`docker compose -f docker-compose.searxng.yml up -d\`, or keep SearXNG available at ${serverConfig.searxngBaseUrl}.`;
}

export async function ensureSearxng(logger: BootstrapLogger, required = false) {
  logger.step('Checking Docker availability for local web search...');

  if (!(await isCommandAvailable('docker', ['compose', 'version']))) {
    if (required) {
      throw new Error(buildRequiredDockerMessage());
    }

    logger.warn('Docker is unavailable. Starting the app without SearXNG-backed web search.');
    return false;
  }

  try {
    logger.step('Starting the local SearXNG container...');
    await startSearxngContainer();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run docker compose.';
    if (required) {
      throw new Error(`${message} Ensure Docker can start the SearXNG container.`);
    }

    logger.warn(`${message} Starting the app without SearXNG-backed web search.`);
    return false;
  }

  logger.step(`Waiting for SearXNG at ${serverConfig.searxngBaseUrl}...`);
  const ready = await waitForCondition(isSearxngReady, {
    timeoutMs: startupTimeoutMs,
    intervalMs: pollIntervalMs,
  });

  if (ready) {
    logger.step('SearXNG is ready. Web search tools are available.');
    return true;
  }

  const message = `SearXNG did not become ready within ${startupTimeoutMs}ms at ${serverConfig.searxngBaseUrl}.`;
  if (required) {
    throw new Error(message);
  }

  logger.warn(`${message} Starting the app in degraded mode.`);
  return false;
}
