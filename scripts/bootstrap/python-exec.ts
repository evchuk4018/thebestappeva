import { serverConfig } from '../../server/config';
import type { BootstrapLogger } from './log';
import { isCommandAvailable, runStreamingCommand, runCommand } from './process';

const imageTag = () => serverConfig.aiPythonExecDockerImage;
const contextDir = 'python';

async function isImagePresent() {
  try {
    const { stdout } = await runCommand('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}', imageTag()]);
    return String(stdout).split(/\r?\n/).some((line) => line.trim() === imageTag());
  } catch {
    return false;
  }
}

export async function isPythonExecRuntimeAvailable() {
  if (!(await isCommandAvailable('docker', ['--version']))) {
    return false;
  }
  return isImagePresent();
}

export async function ensurePythonExecRuntime(logger: BootstrapLogger, required = false) {
  if (!(await isCommandAvailable('docker', ['--version']))) {
    if (required) {
      throw new Error('Docker is required for the python.exec sandbox but was not found.');
    }
    logger.warn('Docker is unavailable. The python.exec tool will run in a fresh one-shot sandbox per call.');
    return false;
  }

  if (await isImagePresent()) {
    logger.step(`python.exec sandbox image is ready (${imageTag()}).`);
    return true;
  }

  logger.step(`Building python.exec sandbox image ${imageTag()}...`);
  try {
    await runStreamingCommand('docker', ['build', '-t', imageTag(), contextDir]);
    logger.step('python.exec sandbox image built.');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to build the python.exec sandbox image.';
    if (required) {
      throw new Error(message);
    }
    logger.warn(`${message} The python.exec tool will fall back to a one-shot sandbox.`);
    return false;
  }
}