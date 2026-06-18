import type { BootstrapLogger } from './log';
import { createDockerDaemonEnsurer, type DockerDaemonEnsurerDeps } from './docker-daemon';

const dockerComposeArgs = ['compose', '-f', 'docker-compose.searxng.yml'];
const searxngStartupTimeoutMs = 15000;
const searxngPollIntervalMs = 1200;

interface SearxngBootstrapDeps extends DockerDaemonEnsurerDeps {
  fetch: typeof fetch;
}

interface SearxngBootstrapConfig {
  dockerDesktopPath?: string;
  searxngBaseUrl: string;
}

function buildDockerCliMissingMessage(searxngBaseUrl: string) {
  return `Docker is unavailable. Install Docker Desktop and start SearXNG with \`docker compose -f docker-compose.searxng.yml up -d\`, or keep SearXNG available at ${searxngBaseUrl}.`;
}

function buildSearxngContainerFailureMessage(error: unknown) {
  return `${toErrorMessage(error, 'Unable to run docker compose.')} Ensure Docker can start the SearXNG container.`;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function createSearxngBootstrap(
  deps: SearxngBootstrapDeps,
  config: SearxngBootstrapConfig,
) {
  const daemonEnsurer = createDockerDaemonEnsurer(deps, {
    dockerDesktopPath: config.dockerDesktopPath,
    serviceLabel: 'SearXNG',
    availabilityHint: `and ensure SearXNG is available at ${config.searxngBaseUrl}`,
    degradeSuffix: 'Starting the app without SearXNG-backed web search.',
  });

  async function isSearxngReady() {
    const searchUrl = new URL('/search', `${config.searxngBaseUrl}/`);
    searchUrl.searchParams.set('q', 'healthcheck');
    searchUrl.searchParams.set('format', 'json');

    const response = await deps.fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    return response.ok;
  }

  async function degradeOrThrow(logger: BootstrapLogger, required: boolean, message: string) {
    if (required) {
      throw new Error(message);
    }

    logger.warn(`${message} Starting the app without SearXNG-backed web search.`);
    return false;
  }

  async function ensureSearxng(logger: BootstrapLogger, required = false) {
    logger.step(`Checking SearXNG at ${config.searxngBaseUrl}...`);
    if (await isSearxngReady().catch(() => false)) {
      logger.step('SearXNG is ready. Web search tools are available.');
      return true;
    }

    logger.step('Checking Docker availability for local web search...');
    if (!(await deps.isCommandAvailable('docker', ['compose', 'version']))) {
      return degradeOrThrow(
        logger,
        required,
        buildDockerCliMissingMessage(config.searxngBaseUrl),
      );
    }

    if (!(await daemonEnsurer.ensureDockerDaemon(logger, required))) {
      return false;
    }

    try {
      logger.step('Starting the local SearXNG container...');
      await deps.runCommand('docker', [...dockerComposeArgs, 'up', '-d']);
    } catch (error) {
      return degradeOrThrow(
        logger,
        required,
        buildSearxngContainerFailureMessage(error),
      );
    }

    logger.step(`Waiting for SearXNG at ${config.searxngBaseUrl}...`);
    const ready = await deps.waitForCondition(isSearxngReady, {
      timeoutMs: searxngStartupTimeoutMs,
      intervalMs: searxngPollIntervalMs,
    });

    if (ready) {
      logger.step('SearXNG is ready. Web search tools are available.');
      return true;
    }

    return degradeOrThrow(
      logger,
      required,
      `SearXNG did not become ready within ${searxngStartupTimeoutMs}ms at ${config.searxngBaseUrl}.`,
    );
  }

  return { ensureSearxng };
}