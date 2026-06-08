import { execFile, ExecFileOptions, spawn, SpawnOptions } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function runCommand(command: string, args: string[], options: ExecFileOptions = {}) {
  return execFileAsync(command, args, {
    cwd: process.cwd(),
    windowsHide: true,
    ...options,
  });
}

export async function isCommandAvailable(command: string, args: string[] = ['--version']) {
  try {
    await runCommand(command, args);
    return true;
  } catch {
    return false;
  }
}

export async function runStreamingCommand(command: string, args: string[], options: SpawnOptions = {}) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      windowsHide: true,
      ...options,
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`${command} exited from signal ${signal}.`));
        return;
      }

      if (code && code !== 0) {
        reject(new Error(`${command} exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

export async function spawnDetachedCommand(command: string, args: string[], options: SpawnOptions = {}) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      ...options,
    });

    child.once('error', reject);
    child.unref();
    setTimeout(resolve, 200);
  });
}
