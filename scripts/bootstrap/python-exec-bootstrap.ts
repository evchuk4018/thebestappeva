import type { BootstrapLogger } from './log';
import { checkDockerDaemonReady, createDockerDaemonEnsurer, type DockerDaemonEnsurerDeps } from './docker-daemon';

const buildContextDir = 'python';

export interface PythonExecBootstrapDeps extends DockerDaemonEnsurerDeps {
  runStreamingCommand: (command: string, args: string[]) => Promise<void>;
  isImagePresent: () => Promise<boolean>;
  runSmokeCheck: (image: string, timeoutMs: number) => Promise<boolean>;
}

export interface PythonExecBootstrapConfig {
  imageTag: string;
  smokeTimeoutMs: number;
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function createPythonExecBootstrap(
  deps: PythonExecBootstrapDeps,
  config: PythonExecBootstrapConfig,
) {
  const daemonEnsurer = createDockerDaemonEnsurer(deps, {
    serviceLabel: 'the python.exec sandbox',
    degradeSuffix: 'The python.exec tool will fall back to a one-shot sandbox.',
  });

  async function degradeOrThrow(logger: BootstrapLogger, required: boolean, message: string) {
    if (required) {
      throw new Error(message);
    }
    logger.warn(`${message} The python.exec tool will fall back to a one-shot sandbox.`);
    return false;
  }

  async function ensureImage(logger: BootstrapLogger, required: boolean) {
    if (await deps.isImagePresent()) {
      return true;
    }
    logger.step(`Building python.exec sandbox image ${config.imageTag}...`);
    try {
      await deps.runStreamingCommand('docker', ['build', '-t', config.imageTag, buildContextDir]);
      return true;
    } catch (error) {
      const message = toErrorMessage(error, 'Unable to build the python.exec sandbox image.');
      if (required) {
        throw new Error(message);
      }
      logger.warn(`${message} The python.exec tool will fall back to a one-shot sandbox.`);
      return false;
    }
  }

  async function ensureSmoke(logger: BootstrapLogger, required: boolean) {
    logger.step(`Verifying the python.exec sandbox image boots (${config.imageTag})...`);
    const ok = await deps.runSmokeCheck(config.imageTag, config.smokeTimeoutMs);
    if (ok) {
      logger.step('python.exec sandbox image is ready.');
      return true;
    }
    return degradeOrThrow(
      logger,
      required,
      `The python.exec sandbox image failed its startup smoke check within ${config.smokeTimeoutMs}ms.`,
    );
  }

  async function ensurePythonExecRuntime(logger: BootstrapLogger, required = false) {
    if (!(await deps.isCommandAvailable('docker', ['--version']))) {
      return degradeOrThrow(
        logger,
        required,
        'Docker is unavailable.',
      );
    }

    if (!(await daemonEnsurer.ensureDockerDaemon(logger, required))) {
      return false;
    }

    if (!(await ensureImage(logger, required))) {
      return false;
    }

    return ensureSmoke(logger, required);
  }

  async function isPythonExecRuntimeAvailable() {
    if (!(await deps.isCommandAvailable('docker', ['--version']))) {
      return false;
    }
    if (!(await checkDockerDaemonReady(deps.runCommand))) {
      return false;
    }
    return deps.isImagePresent();
  }

  return { ensurePythonExecRuntime, isPythonExecRuntimeAvailable };
}