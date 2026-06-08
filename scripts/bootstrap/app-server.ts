import { spawn } from 'node:child_process';
import path from 'node:path';
import type { BootstrapLogger } from './log';

function getTsxExecutable() {
  return path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
}

export async function startAppServerProcess(logger: BootstrapLogger) {
  logger.step('Starting the local app server...');

  const child = spawn(process.execPath, [
    getTsxExecutable(),
    'watch',
    '--exclude',
    '.local-data/**',
    '--exclude',
    'dist/**',
    '--exclude',
    'node_modules/**',
    '--clear-screen=false',
    'server/index.ts',
  ], {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  });

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.off('SIGINT', forwardSignal);
      process.off('SIGTERM', forwardSignal);

      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code && code !== 0) {
        reject(new Error(`The app server exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}
