import { execFile, ExecFileOptions, spawn } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { serverConfig } from '../server/config';

const execFileAsync = promisify(execFile);
const dockerComposeArgs = ['compose', '-f', 'docker-compose.searxng.yml'];
const startupTimeoutMs = 15000;
const pollIntervalMs = 1200;

function logStep(message: string) {
  console.log(`[dev] ${message}`);
}

function logWarn(message: string) {
  console.warn(`[dev] Warning: ${message}`);
}

async function runCommand(command: string, args: string[], options: ExecFileOptions = {}) {
  return execFileAsync(command, args, {
    cwd: process.cwd(),
    windowsHide: true,
    ...options,
  });
}

async function isDockerAvailable() {
  try {
    await runCommand('docker', ['compose', 'version']);
    return true;
  } catch {
    return false;
  }
}

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

async function waitForSearxngReadiness() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    try {
      if (await isSearxngReady()) {
        return true;
      }
    } catch {
      // Keep polling until the timeout window expires.
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return false;
}

async function ensureSearxng() {
  logStep('Checking Docker availability for local web search...');
  if (!(await isDockerAvailable())) {
    logWarn('Docker is unavailable. Starting the app without SearXNG-backed web search.');
    return;
  }

  try {
    logStep('Starting the local SearXNG container...');
    await startSearxngContainer();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run docker compose.';
    logWarn(`${message} Starting the app without SearXNG-backed web search.`);
    return;
  }

  logStep(`Waiting for SearXNG at ${serverConfig.searxngBaseUrl}...`);
  if (await waitForSearxngReadiness()) {
    logStep('SearXNG is ready. Web search tools are available.');
    return;
  }

  logWarn(`SearXNG did not become ready within ${startupTimeoutMs}ms. Starting the app in degraded mode.`);
}

function getTsxExecutable() {
  return path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
}

async function startDevServerProcess() {
  const child = spawn(process.execPath, [getTsxExecutable(), 'server/index.ts'], {
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

async function main() {
  await ensureSearxng();
  logStep('Starting the local app server...');
  await startDevServerProcess();
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unable to start the dev environment.';
  console.error(`[dev] ${message}`);
  process.exit(1);
});
