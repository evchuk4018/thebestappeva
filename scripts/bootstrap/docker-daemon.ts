import type { ExecFileOptions } from 'node:child_process';
import type { BootstrapLogger } from './log';

const defaultDockerDesktopPath = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
const dockerStartupTimeoutMs = 60000;
const dockerPollIntervalMs = 1500;

interface WaitForConditionOptions {
  timeoutMs: number;
  intervalMs: number;
}

export interface DockerDaemonEnsurerDeps {
  isCommandAvailable: (command: string, args?: string[]) => Promise<boolean>;
  platform: NodeJS.Platform;
  fileExists: (path: string) => Promise<boolean>;
  runCommand: (command: string, args: string[], options?: ExecFileOptions) => Promise<unknown>;
  spawnDetachedCommand: (command: string, args: string[]) => Promise<void>;
  waitForCondition: (
    check: () => Promise<boolean>,
    options: WaitForConditionOptions,
  ) => Promise<boolean>;
}

export interface DockerDaemonEnsurerConfig {
  dockerDesktopPath?: string;
  serviceLabel: string;
  availabilityHint?: string;
  degradeSuffix?: string;
}

export type EnsureDockerDaemon = (
  logger: BootstrapLogger,
  required: boolean,
) => Promise<boolean>;

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function checkDockerDaemonReady(
  runCommand: DockerDaemonEnsurerDeps['runCommand'],
) {
  try {
    await runCommand('docker', ['version', '--format', '{{.Server.Version}}']);
    return true;
  } catch {
    return false;
  }
}

export function createDockerDaemonEnsurer(
  deps: DockerDaemonEnsurerDeps,
  config: DockerDaemonEnsurerConfig,
): { ensureDockerDaemon: EnsureDockerDaemon } {
  const dockerDesktopPath = config.dockerDesktopPath ?? defaultDockerDesktopPath;

  function buildDaemonUnavailableMessage() {
    const hint = config.availabilityHint ? ` ${config.availabilityHint}` : '';
    return `Docker is installed but the daemon is unavailable. Start Docker so ${config.serviceLabel} can run${hint}.`;
  }

  function buildDesktopMissingMessage() {
    const hint = config.availabilityHint ? ` ${config.availabilityHint}` : '';
    return `Docker Desktop was not found at ${dockerDesktopPath}. Start Docker manually${hint}.`;
  }

  function buildDaemonTimeoutMessage() {
    return `Docker Desktop did not become ready within ${dockerStartupTimeoutMs}ms. Ensure the Docker daemon is running and try again.`;
  }

  async function degradeOrThrow(logger: BootstrapLogger, required: boolean, message: string) {
    if (required) {
      throw new Error(message);
    }
    const suffix = config.degradeSuffix ? ` ${config.degradeSuffix}` : '';
    logger.warn(`${message}${suffix}`);
    return false;
  }

  async function waitForDockerDaemon() {
    return deps.waitForCondition(
      () => checkDockerDaemonReady(deps.runCommand),
      { timeoutMs: dockerStartupTimeoutMs, intervalMs: dockerPollIntervalMs },
    );
  }

  async function ensureDockerDaemon(logger: BootstrapLogger, required: boolean) {
    if (await checkDockerDaemonReady(deps.runCommand)) {
      logger.step('Docker daemon is ready.');
      return true;
    }

    if (deps.platform !== 'win32') {
      return degradeOrThrow(logger, required, buildDaemonUnavailableMessage());
    }

    if (!(await deps.fileExists(dockerDesktopPath))) {
      return degradeOrThrow(logger, required, buildDesktopMissingMessage());
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
      return degradeOrThrow(logger, required, buildDaemonTimeoutMessage());
    }

    logger.step('Docker daemon is ready.');
    return true;
  }

  return { ensureDockerDaemon };
}