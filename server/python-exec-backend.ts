import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import { HttpError } from './http';
import { serverConfig } from './config';

export interface PythonExecRawResult {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  error?: string;
  reset?: boolean;
  pong?: boolean;
}

export interface PythonExecExecOptions {
  outputCharLimit: number;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface PythonExecSession {
  readonly chatId: string;
  readonly alive: boolean;
  exec(code: string, options: PythonExecExecOptions): Promise<PythonExecRawResult>;
  reset(): Promise<void>;
  kill(): Promise<void>;
}

export interface PythonExecBackend {
  openSession(chatId: string, workDir: string, inputsDir: string): Promise<PythonExecSession>;
  readonly available: boolean;
}

interface LineProtocolSessionOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

class LineProtocolSession implements PythonExecSession {
  readonly chatId: string;
  private readonly child: ChildProcess;
  private readonly pending = new Map<number, (value: PythonExecRawResult) => void>();
  private nextId = 1;
  private buffer = '';
  private stderr = '';
  private readonly workDir: string;
  private _alive = true;

  constructor(chatId: string, workDir: string, options: LineProtocolSessionOptions) {
    this.chatId = chatId;
    this.workDir = workDir;
    this.child = spawn(options.command, options.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, ...options.env },
    });
    this.child.stdout?.setEncoding('utf8');
    this.child.stdout?.on('data', (chunk: string) => this.onData(chunk));
    this.child.stderr?.setEncoding('utf8');
    this.child.stderr?.on('data', (chunk: string) => this.onStderr(chunk));
    this.child.once('close', () => {
      this._alive = false;
      const error = this.stderr.trim() || 'The Python sandbox exited unexpectedly.';
      this.resolvePending({ ok: false, exitCode: 1, stdout: '', stderr: error, durationMs: 0, stdoutTruncated: false, stderrTruncated: false, error });
    });
    this.child.once('error', (error) => {
      this._alive = false;
      const message = `Unable to start the isolated Python sandbox: ${error.message}`;
      this.resolvePending({ ok: false, exitCode: 1, stdout: '', stderr: message, durationMs: 0, stdoutTruncated: false, stderrTruncated: false, error: message });
    });
  }

  get alive() {
    return this._alive && !this.child.killed && this.child.exitCode === null;
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      newlineIndex = this.buffer.indexOf('\n');
      if (!line) {
        continue;
      }
      this.dispatch(line);
    }
  }

  private onStderr(chunk: string) {
    this.stderr = `${this.stderr}${chunk}`.slice(-4000);
  }

  private resolvePending(result: PythonExecRawResult) {
    for (const resolve of this.pending.values()) {
      resolve(result);
    }
    this.pending.clear();
  }

  private dispatch(line: string) {
    let payload: PythonExecRawResult;
    try {
      payload = JSON.parse(line) as PythonExecRawResult;
    } catch {
      return;
    }
    const id = typeof (payload as unknown as { id?: number }).id === 'number'
      ? (payload as unknown as { id: number }).id
      : this.pending.keys().next().value;
    const resolve = this.pending.get(id);
    if (resolve) {
      this.pending.delete(id);
      resolve(payload);
    }
  }

  async ping(timeoutMs: number): Promise<PythonExecRawResult> {
    if (!this.alive) {
      const error = this.stderr.trim() || 'The Python sandbox is not running.';
      return { ok: false, exitCode: 1, stdout: '', stderr: error, durationMs: 0, stdoutTruncated: false, stderrTruncated: false, error };
    }
    const id = this.nextId;
    this.nextId += 1;
    let resolveFn: (value: PythonExecRawResult) => void = () => undefined;
    const promise = new Promise<PythonExecRawResult>((resolve) => {
      resolveFn = resolve;
    });
    this.pending.set(id, resolveFn);
    const timeoutId = setTimeout(() => {
      if (this.pending.delete(id)) {
        this.kill();
        const error = `The Python sandbox did not become ready within ${timeoutMs}ms.`;
        resolveFn({ ok: false, exitCode: 1, stdout: '', stderr: error, durationMs: timeoutMs, stdoutTruncated: false, stderrTruncated: false, error });
      }
    }, timeoutMs);
    void promise.finally(() => clearTimeout(timeoutId));
    this.child.stdin?.write(`${JSON.stringify({ id, type: 'ping' })}\n`);
    return promise;
  }

  async exec(code: string, options: PythonExecExecOptions): Promise<PythonExecRawResult> {
    if (!this.alive) {
      return { ok: false, exitCode: 1, stdout: '', stderr: 'The Python sandbox is not running.', durationMs: 0, stdoutTruncated: false, stderrTruncated: false, error: 'The Python sandbox is not running.' };
    }
    const id = this.nextId;
    this.nextId += 1;
    let resolveFn: (value: PythonExecRawResult) => void = () => undefined;
    const promise = new Promise<PythonExecRawResult>((resolve) => {
      resolveFn = resolve;
    });
    this.pending.set(id, resolveFn);
    const timeoutId = setTimeout(() => {
      if (this.pending.delete(id)) {
        this.kill();
        resolveFn({ ok: false, exitCode: 1, stdout: '', stderr: `The local Python sandbox timed out after ${options.timeoutMs}ms.`, durationMs: options.timeoutMs, stdoutTruncated: false, stderrTruncated: false, error: `timeout_${options.timeoutMs}` });
      }
    }, options.timeoutMs);
    const onAbort = () => {
      if (this.pending.delete(id)) {
        this.kill();
        resolveFn({ ok: false, exitCode: 1, stdout: '', stderr: 'The Python execution was cancelled.', durationMs: 0, stdoutTruncated: false, stderrTruncated: false, error: 'aborted' });
      }
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    void promise.finally(() => {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', onAbort);
    });
    this.child.stdin?.write(`${JSON.stringify({ id, type: 'exec', code, outputCharLimit: options.outputCharLimit })}\n`);
    return promise;
  }

  async reset(): Promise<void> {
    if (!this.alive) {
      return;
    }
    const id = this.nextId;
    this.nextId += 1;
    let resolveFn: () => void = () => undefined;
    const promise = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });
    this.pending.set(id, () => resolveFn());
    const timeoutId = setTimeout(() => {
      if (this.pending.delete(id)) {
        resolveFn();
      }
    }, 5000);
    void promise.finally(() => clearTimeout(timeoutId));
    this.child.stdin?.write(`${JSON.stringify({ id, type: 'reset' })}\n`);
    await promise;
  }

  async kill(): Promise<void> {
    this._alive = false;
    this.child.stdin?.end(() => {
      this.child.kill();
    });
    if (!this.child.killed) {
      this.child.kill();
    }
  }
}

export class DockerPythonExecBackend implements PythonExecBackend {
  readonly available: boolean;

  constructor(available = true) {
    this.available = available;
  }

  async openSession(chatId: string, workDir: string, inputsDir: string): Promise<PythonExecSession> {
    await fs.mkdir(workDir, { recursive: true }).catch(() => undefined);
    await fs.mkdir(inputsDir, { recursive: true }).catch(() => undefined);
    const memLimit = `${serverConfig.aiPythonExecMemoryMb}m`;
    const args = [
      'run', '-i', '--rm',
      '--network=none',
      `--memory=${memLimit}`,
      `--memory-swap=${memLimit}`,
      '--read-only',
      '--user', 'pyworker',
      '-v', `${workDir}:/work`,
      '-v', `${inputsDir}:/inputs:ro`,
      '-w', '/work',
      serverConfig.aiPythonExecDockerImage,
    ];
    const session = new LineProtocolSession(chatId, workDir, { command: 'docker', args, env: { PYTHON_EXEC_INPUTS_DIR: '/inputs' } });
    const startup = await session.ping(Math.min(5000, serverConfig.aiPythonExecSmokeTimeoutMs));
    if (!startup.ok || startup.pong !== true) {
      await session.kill().catch(() => undefined);
      throw new HttpError(503, startup.stderr.trim() || startup.error || 'Unable to start the isolated Python sandbox.');
    }
    return session;
  }
}

export interface PythonExecBackendOverride {
  backend?: PythonExecBackend;
}
