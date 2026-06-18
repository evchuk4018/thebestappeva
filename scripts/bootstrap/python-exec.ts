import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { serverConfig } from '../../server/config';
import { createPythonExecBootstrap, type PythonExecBootstrapDeps } from './python-exec-bootstrap';
import { isCommandAvailable, runCommand, runStreamingCommand, spawnDetachedCommand } from './process';
import { waitForCondition } from './wait';

async function isImagePresent() {
  try {
    const { stdout } = await runCommand('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}', serverConfig.aiPythonExecDockerImage]);
    return String(stdout).split(/\r?\n/).some((line) => line.trim() === serverConfig.aiPythonExecDockerImage);
  } catch {
    return false;
  }
}

function runSmokeCheck(image: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let buffer = '';
    const child = spawn('docker', [
      'run', '-i', '--rm',
      '--network=none',
      '--read-only',
      '--user', 'pyworker',
      image,
    ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.stdin?.end();
      child.kill();
      resolve(false);
    }, timeoutMs);

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdin?.end();
      child.kill();
      resolve(ok);
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
        if (!line) {
          continue;
        }
        try {
          const payload = JSON.parse(line) as { pong?: boolean };
          if (payload.pong === true) {
            child.stdin?.write(`${JSON.stringify({ id: 2, type: 'quit' })}\n`);
            setTimeout(() => finish(true), 200);
            return;
          }
        } catch {
          // Ignore non-JSON diagnostic output from the worker.
        }
      }
    });

    child.once('error', () => finish(false));
    child.once('close', () => {
      if (!settled) {
        finish(true);
      }
    });

    child.stdin?.write(`${JSON.stringify({ id: 1, type: 'ping' })}\n`);
  });
}

const deps: PythonExecBootstrapDeps = {
  isCommandAvailable,
  platform: process.platform,
  fileExists: async (path) => {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  runCommand,
  spawnDetachedCommand,
  waitForCondition,
  runStreamingCommand,
  isImagePresent,
  runSmokeCheck,
};

const bootstrap = createPythonExecBootstrap(deps, {
  imageTag: serverConfig.aiPythonExecDockerImage,
  smokeTimeoutMs: serverConfig.aiPythonExecSmokeTimeoutMs,
});

export const { ensurePythonExecRuntime, isPythonExecRuntimeAvailable } = bootstrap;