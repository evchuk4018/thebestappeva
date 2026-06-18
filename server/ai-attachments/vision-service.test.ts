import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../http';
import { serverConfig } from '../config';
import { setImageToolTimingForTests } from './image-tool-runtime';
import { answerImageQuestionWithVisionProvider, describeImageWithVisionProvider, setVisionServiceTestHooksForTests } from './vision-service';

const originalMaxRetries = serverConfig.visionMaxRetries;

test.afterEach(() => {
  serverConfig.visionMaxRetries = originalMaxRetries;
  setVisionServiceTestHooksForTests({});
  setImageToolTimingForTests(null);
});

test('offline mode uses the local provider only', async () => {
  const calls: string[] = [];
  setVisionServiceTestHooksForTests({
    mode: 'offline',
    localProvider: {
      provider: 'local',
      async healthCheck() {
        return { available: true, provider: 'local', detail: 'ready' };
      },
      async describeImage() {
        calls.push('local-describe');
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local summary.' };
      },
      async answerImageQuestion() {
        calls.push('local-question');
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local answer.' };
      },
    },
    onlineProvider: {
      provider: 'gemini',
      async healthCheck() {
        return { available: true, provider: 'gemini', detail: 'ready' };
      },
      async describeImage() {
        calls.push('online-describe');
        return { provider: 'gemini', model: 'gemini-2.5-flash-lite', text: 'Online summary.' };
      },
      async answerImageQuestion() {
        calls.push('online-question');
        return { provider: 'gemini', model: 'gemini-2.5-flash', text: 'Online answer.' };
      },
    },
  });

  const summary = await describeImageWithVisionProvider('ZmFrZQ==');
  const answer = await answerImageQuestionWithVisionProvider('ZmFrZQ==', 'What is visible?');

  assert.equal(summary.metadata.provider, 'local');
  assert.equal(answer.metadata.provider, 'local');
  assert.deepEqual(calls, ['local-describe', 'local-question']);
});

test('online mode retries the online provider before falling back to local', async () => {
  let attempts = 0;
  serverConfig.visionMaxRetries = 1;
  setImageToolTimingForTests({ attemptTimeoutMs: 10, retryDelayMs: 1, totalTimeoutMs: 40 });
  setVisionServiceTestHooksForTests({
    mode: 'online',
    localProvider: {
      provider: 'local',
      async healthCheck() {
        return { available: true, provider: 'local', detail: 'ready' };
      },
      async describeImage() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Fallback summary.' };
      },
      async answerImageQuestion() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Fallback answer.' };
      },
    },
    onlineProvider: {
      provider: 'gemini',
      async healthCheck() {
        return { available: true, provider: 'gemini', detail: 'ready' };
      },
      async describeImage() {
        attempts += 1;
        throw new HttpError(504, 'Gemini timed out.');
      },
      async answerImageQuestion() {
        throw new Error('Not used in this test.');
      },
    },
  });

  const summary = await describeImageWithVisionProvider('ZmFrZQ==');

  assert.equal(attempts, 2);
  assert.equal(summary.metadata.provider, 'local');
  assert.equal(summary.metadata.fallbackUsed, true);
  assert.match(summary.metadata.notice ?? '', /local vision model/i);
});

test('online mode returns the online provider response when it succeeds', async () => {
  setVisionServiceTestHooksForTests({
    mode: 'online',
    localProvider: {
      provider: 'local',
      async healthCheck() {
        return { available: true, provider: 'local', detail: 'ready' };
      },
      async describeImage() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local summary.' };
      },
      async answerImageQuestion() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local answer.' };
      },
    },
    onlineProvider: {
      provider: 'gemini',
      async healthCheck() {
        return { available: true, provider: 'gemini', detail: 'ready' };
      },
      async describeImage() {
        return { provider: 'gemini', model: 'gemini-2.5-flash-lite', text: 'Online summary.' };
      },
      async answerImageQuestion() {
        return {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          text: 'Online answer.',
          inputTokens: 100,
          outputTokens: 25,
          totalTokens: 125,
          estimatedCostUsd: 0.000375,
        };
      },
    },
  });

  const answer = await answerImageQuestionWithVisionProvider('ZmFrZQ==', 'Read the small text in this diagram.');

  assert.equal(answer.text, 'Online answer.');
  assert.equal(answer.metadata.provider, 'gemini');
  assert.equal(answer.metadata.fallbackUsed, false);
  assert.equal(answer.metadata.totalTokens, 125);
});

test('online mode retries a transient 503 once before succeeding', async () => {
  let attempts = 0;
  setImageToolTimingForTests({ attemptTimeoutMs: 10, retryDelayMs: 1, totalTimeoutMs: 40 });
  setVisionServiceTestHooksForTests({
    mode: 'online',
    localProvider: {
      provider: 'local',
      async healthCheck() {
        return { available: true, provider: 'local', detail: 'ready' };
      },
      async describeImage() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local summary.' };
      },
      async answerImageQuestion() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local answer.' };
      },
    },
    onlineProvider: {
      provider: 'gemini',
      async healthCheck() {
        return { available: true, provider: 'gemini', detail: 'ready' };
      },
      async describeImage() {
        attempts += 1;
        if (attempts === 1) {
          throw new HttpError(503, 'Temporary overload.');
        }
        return { provider: 'gemini', model: 'gemini-2.5-flash-lite', text: 'Recovered summary.' };
      },
      async answerImageQuestion() {
        throw new Error('Not used in this test.');
      },
    },
  });

  const summary = await describeImageWithVisionProvider('ZmFrZQ==');
  assert.equal(summary.text, 'Recovered summary.');
  assert.equal(summary.metadata.provider, 'gemini');
  assert.equal(attempts, 2);
});

test('online mode does not retry permanent 400 provider failures', async () => {
  let attempts = 0;
  setVisionServiceTestHooksForTests({
    mode: 'online',
    localProvider: {
      provider: 'local',
      async healthCheck() {
        return { available: true, provider: 'local', detail: 'ready' };
      },
      async describeImage() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local fallback summary.' };
      },
      async answerImageQuestion() {
        return { provider: 'local', model: 'qwen2.5vl:7b', text: 'Local fallback answer.' };
      },
    },
    onlineProvider: {
      provider: 'gemini',
      async healthCheck() {
        return { available: true, provider: 'gemini', detail: 'ready' };
      },
      async describeImage() {
        attempts += 1;
        throw new HttpError(400, 'Bad request.');
      },
      async answerImageQuestion() {
        throw new Error('Not used in this test.');
      },
    },
  });

  const summary = await describeImageWithVisionProvider('ZmFrZQ==');
  assert.equal(summary.metadata.provider, 'local');
  assert.equal(summary.metadata.fallbackUsed, true);
  assert.equal(attempts, 1);
});
