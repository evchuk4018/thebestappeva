import assert from 'node:assert/strict';
import test from 'node:test';
import { createPythonExecBootstrap } from './python-exec-bootstrap';

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
  fileExists?: boolean;
  platform?: NodeJS.Platform;
  imagePresent?: boolean;
  smokeOk?: boolean;
  buildError?: Error;
  waitForConditionResults?: boolean[];
}) {
  const dockerDaemonReadySequence = [...(options?.dockerDaemonReadySequence ?? [true])];
  const waitForConditionResults = [...(options?.waitForConditionResults ?? [])];
  const runCalls: Array<{ command: string; args: string[] }> = [];
  const spawnCalls: Array<{ command: string; args: string[] }> = [];
  const streamingCalls: Array<{ command: string; args: string[] }> = [];
  const smokeCalls: Array<{ image: string; timeoutMs: number }> = [];

  const bootstrap = createPythonExecBootstrap({
    isCommandAvailable: async () => options?.dockerCliAvailable ?? true,
    platform: options?.platform ?? 'win32',
    fileExists: async () => options?.fileExists ?? true,
    runCommand: async (command, args) => {
      runCalls.push({ command, args });
      if (args[0] === 'version') {
        const ready = dockerDaemonReadySequence.shift() ?? false;
        if (!ready) {
          throw new Error('daemon unavailable');
        }
        return { stdout: '25.0.0' };
      }
      return { stdout: '' };
    },
    spawnDetachedCommand: async (command, args) => {
      spawnCalls.push({ command, args });
    },
    waitForCondition: async (check) => {
      const next = waitForConditionResults.shift();
      return typeof next === 'boolean' ? next : check();
    },
    runStreamingCommand: async (command, args) => {
      streamingCalls.push({ command, args });
      if (options?.buildError) {
        throw options.buildError;
      }
    },
    isImagePresent: async () => options?.imagePresent ?? false,
    runSmokeCheck: async (image, timeoutMs) => {
      smokeCalls.push({ image, timeoutMs });
      return options?.smokeOk ?? true;
    },
  }, {
    imageTag: 'thebestappeva-python-exec:latest',
    smokeTimeoutMs: 15000,
  });

  return { bootstrap, runCalls, spawnCalls, streamingCalls, smokeCalls };
}

test('degrades when the Docker CLI is unavailable', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap, runCalls, spawnCalls, streamingCalls, smokeCalls } = createBootstrap({
    dockerCliAvailable: false,
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, false);
  assert.equal(runCalls.length, 0);
  assert.equal(spawnCalls.length, 0);
  assert.equal(streamingCalls.length, 0);
  assert.equal(smokeCalls.length, 0);
  assert.match(warnings[0] ?? '', /Docker is unavailable/i);
});

test('builds the image and runs the smoke check when the daemon is ready', async () => {
  const { logger, steps, warnings } = createLogger();
  const { bootstrap, streamingCalls, smokeCalls } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: false,
    smokeOk: true,
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, true);
  assert.equal(warnings.length, 0);
  assert.equal(streamingCalls[0]?.args[0], 'build');
  assert.equal(smokeCalls[0]?.image, 'thebestappeva-python-exec:latest');
  assert.equal(smokeCalls[0]?.timeoutMs, 15000);
  assert.equal(steps.includes('Docker daemon is ready.'), true);
  assert.equal(steps.includes('python.exec sandbox image is ready.'), true);
});

test('skips the build but still smokes when the image is already present', async () => {
  const { logger, steps } = createLogger();
  const { bootstrap, streamingCalls, smokeCalls } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: true,
    smokeOk: true,
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, true);
  assert.equal(streamingCalls.length, 0);
  assert.equal(smokeCalls.length, 1);
  assert.match(steps.join('\n'), /Verifying the python.exec sandbox image boots/i);
});

test('launches Docker Desktop when the daemon is down on Windows', async () => {
  const { logger, steps } = createLogger();
  const { bootstrap, spawnCalls } = createBootstrap({
    dockerDaemonReadySequence: [false],
    waitForConditionResults: [true],
    imagePresent: true,
    smokeOk: true,
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, true);
  assert.equal(spawnCalls[0]?.command, 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe');
  assert.equal(steps.includes('Waiting for Docker Desktop to become ready...'), true);
  assert.equal(steps.includes('python.exec sandbox image is ready.'), true);
});

test('degrades when Docker Desktop is missing during plain dev startup', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap, spawnCalls } = createBootstrap({
    dockerDaemonReadySequence: [false],
    fileExists: false,
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, false);
  assert.equal(spawnCalls.length, 0);
  assert.match(warnings[0] ?? '', /Docker Desktop was not found/i);
  assert.match(warnings[0] ?? '', /one-shot sandbox/i);
});

test('fails fast for ai:dev when Docker Desktop never becomes ready', async () => {
  const { logger } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [false],
    waitForConditionResults: [false],
  });

  await assert.rejects(
    () => bootstrap.ensurePythonExecRuntime(logger, true),
    /Docker Desktop did not become ready within 60000ms/i,
  );
});

test('degrades when the smoke check fails during plain dev startup', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: true,
    smokeOk: false,
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, false);
  assert.match(warnings[0] ?? '', /smoke check/i);
  assert.match(warnings[0] ?? '', /one-shot sandbox/i);
});

test('fails fast for ai:dev when the smoke check fails', async () => {
  const { logger } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: true,
    smokeOk: false,
  });

  await assert.rejects(
    () => bootstrap.ensurePythonExecRuntime(logger, true),
    /smoke check/i,
  );
});

test('fails fast for ai:dev when the image build fails', async () => {
  const { logger } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: false,
    buildError: new Error('docker build exploded'),
  });

  await assert.rejects(
    () => bootstrap.ensurePythonExecRuntime(logger, true),
    /docker build exploded/i,
  );
});

test('degrades when the image build fails during plain dev startup', async () => {
  const { logger, warnings } = createLogger();
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: false,
    buildError: new Error('docker build exploded'),
  });

  const ready = await bootstrap.ensurePythonExecRuntime(logger);

  assert.equal(ready, false);
  assert.match(warnings[0] ?? '', /docker build exploded/i);
  assert.match(warnings[0] ?? '', /one-shot sandbox/i);
});

test('isPythonExecRuntimeAvailable reports ready when the daemon and image are present', async () => {
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: true,
  });

  assert.equal(await bootstrap.isPythonExecRuntimeAvailable(), true);
});

test('isPythonExecRuntimeAvailable reports not ready when the image is absent', async () => {
  const { bootstrap } = createBootstrap({
    dockerDaemonReadySequence: [true],
    imagePresent: false,
  });

  assert.equal(await bootstrap.isPythonExecRuntimeAvailable(), false);
});