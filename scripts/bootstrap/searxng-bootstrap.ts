import type { ExecFileOptions } from 'node:child_process';
import type { BootstrapLogger } from './log';

const dockerComposeArgs = ['compose', '-f', 'docker-compose.searxng.yml'];
const defaultDockerDesktopPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
const searxngStartupTimeoutMs = 15000;
const searxngPollIntervalMs = 1200;
const dockerStartupTimeoutMs = 60000;
const dockerPollIntervalMs = 1500;

interface WaitForConditionOptions {
  timeoutMs: number;
  intervalMs: number;
}

interface SearxngBootstrapDeps {
  fetch: typeof fetch;
  fileExists: (path: string) => Promise<boolean>;
  isCommandAvailable: (command: string, args?: string[]) => Promise<boolean>;
  platform: NodeJS.Platform;
  runCommand: (command: string, args: string[], options?: ExecFileOptions) => Promise<unknown>;
  spawnDetachedCommand: (command: string, args: string[]) => Promise<void>;
  waitForCondition: (
    check: () => Promise<boolean>,
    options: WaitForConditionOptions,
  ) => Promise<boolean>;
}

interface SearxngBootstrapConfig {
  dockerDesktopPath?: string;
  searxngBaseUrl: string;
}

function buildDockerCliMissingMessage(searxngBaseUrl: string) {
  return `Docker is unavailable. Install Docker Desktop and start SearXNG with \`docker compose -f docker-compose.searxng.yml up -d\`, or keep SearXNG available at ${searxngBaseUrl}.`;
}

function buildDockerDesktopMissingMessage(searxngBaseUrl: string, dockerDesktopPath: string) {
  return `Docker Desktop was not found at ${dockerDesktopPath}. Start Docker manually and ensure SearXNG is available at ${searxngBaseUrl}.`;
}

function buildDockerDaemonTimeoutMessage(timeoutMs: number) {
  return `Docker Desktop did not become ready within ${timeoutMs}ms. Ensure the Docker daemon is running and try again.`;
}

function buildDockerDaemonUnavailableMessage(searxngBaseUrl: string) {
  return `Docker is installed but the daemon is unavailable. Start Docker so SearXNG can boot at ${searxngBaseUrl}.`;
}

function buildSearxngContainerFailureMessage(error: unknown) {
  return `${toErrorMessage(error, 'Unable to run docker compose.')} Ensure Docker can start the SearXNG container.`;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function checkDockerDaemonReady(
  runCommand: SearxngBootstrapDeps['runCommand'],
) {
  try {
    await runCommand('docker', ['version', '--format', '{{.Server.Version}}']);
    return true;
  } catch {
    return false;
  }
}

export function createSearxngBootstrap(
  deps: SearxngBootstrapDeps,
  config: SearxngBootstrapConfig,
) {
  const dockerDesktopPath = config.dockerDesktopPath ?? defaultDockerDesktopPath;

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

  async function waitForDockerDaemon() {
    return deps.waitForCondition(
      () => checkDockerDaemonReady(deps.runCommand),
      {
        timeoutMs: dockerStartupTimeoutMs,
        intervalMs: dockerPollIntervalMs,
      },
    );
  }

  async function ensureDockerDaemon(logger: BootstrapLogger, required: boolean) {
    if (await checkDockerDaemonReady(deps.runCommand)) {
      logger.step('Docker daemon is ready.');
      return true;
    }

    if (deps.platform !== 'win32') {
      return degradeOrThrow(
        logger,
        required,
        buildDockerDaemonUnavailableMessage(config.searxngBaseUrl),
      );
    }

    if (!(await deps.fileExists(dockerDesktopPath))) {
      return degradeOrThrow(
        logger,
        required,
        buildDockerDesktopMissingMessage(config.searxngBaseUrl, dockerDesktopPath),
      );
    }

    logger.step(`Docker daemon is unavailable. Launching Docker Desktop from ${dockerDesktopPath}...`);
    try {
      await deps.spawnDetachedCommand(dockerDesktopPath, []);
    } catch (error) {
      return degradeOrThrow(
        logger,
        required,
        `Unable to launch Docker Desktop. ${toErrorMessage(error, 'Launch failed.')}`,
      );
    }

    logger.step('Waiting for Docker Desktop to become ready...');
    if (!(await waitForDockerDaemon())) {
      return degradeOrThrow(
        logger,
        required,
        buildDockerDaemonTimeoutMessage(dockerStartupTimeoutMs),
      );
    }

    logger.step('Docker daemon is ready.');
    return true;
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

    if (!(await ensureDockerDaemon(logger, required))) {
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

