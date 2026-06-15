import assert from 'node:assert/strict';
import test from 'node:test';
import { createSearxngBootstrap } from './searxng-bootstrap';

function createLogger() {
  const steps: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  return {
    logger: {
      step(message: string) {
        steps.push(message);
      },
      warn(message: string) {
        warnings.push(message);
      },
      error(message: string) {
        errors.push(message);
      },
    },
    errors,
    steps,
    warnings,
  };
}

function createBootstrap(options?: {
  dockerCliAvailable?: boolean;
  dockerDaemonReadySequence?: boolean[];
  fetchSequence?: boolean[];
  fileExists?: boolean;
  platform?: NodeJS.Platform;
  spawnError?: Error;
  upError?: Error;
  waitForConditionResults?: boolean[];
}) {
  const dockerDaemonReadySequence = [...(options?.dockerDaemonReadySequence ?? [true])];
  const fetchSequence = [...(options?.fetchSequence ?? [false, true])];
  const waitForConditionResults = [...(options?.waitForConditionResults ?? [])];
  const runCalls: Array<{ command: string; args: string[] }> = [];
  const spawnCalls: Array<{ command: string; args: string[] }> = [];

  const bootstrap = createSearxngBootstrap({
    fetch: async () => new Response('', { status: fetchSequence.shift() ? 200 : 503 }),
    fileExists: async () => options?.fileExists ?? true,
    isCommandAvailable: async () => options?.dockerCliAvailable ?? true,
    platform: options?.platform ?? 'win32',
    runCommand: async (command, args) => {
      runCalls.push({ command, args });
      if (args[0] === 'version') {
        const ready = dockerDaemonReadySequence.shift() ?? false;
        if (!ready) {
          throw new Error('daemon unavailable');
        }
        return { stdout: '25.0.0' };
      }

      if (args.includes('up') && options?.upError) {
        throw options.upError;
      }

      return { stdout: '' };
    },
    spawnDetachedCommand: async (command, args) => {
      spawnCalls.push({ command, args });
      if (options?.spawnError) {
        throw options.spawnError;
      }
    },
    waitForCondition: async (check) => {
      const next = waitForConditionResults.shift();
      return typeof next === 'boolean' ? next : check();
    },
  }, {
    searxngBaseUrl: 'http://127.0.0.1:8888',
  });

  return { bootstrap, runCalls, spawnCalls };
}

test('degrades when the Docker CLI is unavailable', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap, runCalls, spawnCalls } = createBootstrap({
    dockerCliAvailable: false,
    fetchSequence: [false],
  });

  const ready = await bootstrap.ensureSearxng(logger);

  assert.equal(ready, false);
  assert.equal(runCalls.length, 0);
  assert.equal(spawnCalls.length, 0);
  assert.match(warnings[0] ?? '', /Docker is unavailable/i);
});

test('uses an already-ready Docker daemon without launching Docker Desktop', async () => {
  const { logger, steps, warnings } = createLogger();
  const { bootstrap, runCalls, spawnCalls } = createBootstrap({
    dockerDaemonReadySequence: [true],
    fetchSequence: [false, true],
  });

  const ready = await bootstrap.ensureSearxng(logger);

  assert.equal(ready, true);
  assert.equal(spawnCalls.length, 0);
  assert.equal(runCalls.some((call) => call.args.join(' ') === 'version --format {{.Server.Version}}'), true);
  assert.equal(runCalls.some((call) => call.args.includes('up')), true);
  assert.equal(warnings.length, 0);
  assert.equal(steps.includes('Docker daemon is ready.'), true);
});

test('launches Docker Desktop and waits for the daemon before starting SearXNG', async () => {
  const { logger, steps } = createLogger();
  const { bootstrap, runCalls, spawnCalls } = createBootstrap({
    dockerDaemonReadySequence: [false],
    fetchSequence: [false, true],
    waitForConditionResults: [true],
  });

  const ready = await bootstrap.ensureSearxng(logger);

  assert.equal(ready, true);
  assert.equal(spawnCalls[0]?.command, 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe');
  assert.equal(runCalls.some((call) => call.args.includes('up')), true);
  assert.equal(steps.includes('Waiting for Docker Desktop to become ready...'), true);
});

test('degrades when Docker Desktop is missing during plain dev startup', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap, spawnCalls } = createBootstrap({
    dockerDaemonReadySequence: [false],
    fetchSequence: [false],
    fileExists: false,
    waitForConditionResults: [false],
  });

  const ready = await bootstrap.ensureSearxng(logger);

  assert.equal(ready, false);
  assert.equal(spawnCalls.length, 0);
  assert.match(warnings[0] ?? '', /Docker Desktop was not found/i);
});

test('fails fast for ai:dev when Docker Desktop never becomes ready', async () => {
  const { logger } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [false],
    fetchSequence: [false],
    waitForConditionResults: [false],
  });

  await assert.rejects(
    () => bootstrap.ensureSearxng(logger, true),
    /Docker Desktop did not become ready within 60000ms/i,
  );
});

test('fails fast when the SearXNG container cannot be started in required mode', async () => {
  const { logger } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    fetchSequence: [false],
    upError: new Error('compose failed'),
  });

  await assert.rejects(
    () => bootstrap.ensureSearxng(logger, true),
    /compose failed/i,
  );
});

test('degrades when SearXNG never becomes healthy after the container starts', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    fetchSequence: [false],
    waitForConditionResults: [false],
  });

  const ready = await bootstrap.ensureSearxng(logger);

  assert.equal(ready, false);
  assert.match(warnings[0] ?? '', /SearXNG did not become ready within 15000ms/i);
});
