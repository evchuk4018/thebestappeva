import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { HttpError } from './http';
import { serverConfig } from './config';
import { collectGeneratedFiles, ensureChatWorkspace } from './python-exec-paths';
import type { PythonExecRequest, PythonExecResponse, PythonExecSessionStatus, PythonExecStagedFile } from '../shared/ai-python-exec-contract';

const blockedRoots = new Set(['.git', '.local-data', '.vite', 'dist', 'node_modules']);
const sidecarScriptPath = path.resolve(process.cwd(), 'python', 'exec_sidecar.py');

interface PythonExecRunnerInput {
  args: string[];
  command: string;
  stdin: string;
  timeoutMs: number;
}

interface PythonExecServiceOptions {
  chatId?: string;
  inputsRoot?: string;
  preserveSandbox?: boolean;
  projectRoot?: string;
  runProcess?: (input: PythonExecRunnerInput) => Promise<{ stderr: string; stdout: string }>;
  sandboxRoot?: string;
  sessionStatus?: PythonExecSessionStatus;
  workDir?: string;
  workspaceRoot?: string;
}

function expectRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `Invalid ${field}. Expected an object.`);
  }
  return value as Record<string, unknown>;
}

function normalizeRequestedPath(value: string) {
  return value.replace(/\\/g, '/').trim();
}

function buildSandboxError(message: string) {
  return new HttpError(400, message);
}

function validateRequestedFilePath(projectRoot: string, requestedPath: string) {
  const normalized = normalizeRequestedPath(requestedPath);
  if (!normalized) {
    throw buildSandboxError('Python exec file paths must be non-empty strings.');
  }
  if (path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    throw buildSandboxError(`Python exec file "${requestedPath}" must be repo-relative.`);
  }

  const rootSegment = normalized.split('/')[0];
  if (blockedRoots.has(rootSegment)) {
    throw buildSandboxError(`Python exec cannot stage files from "${rootSegment}".`);
  }

  const resolvedPath = path.resolve(projectRoot, normalized);
  const relative = path.relative(projectRoot, resolvedPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw buildSandboxError(`Python exec file "${requestedPath}" must stay inside the repo root.`);
  }

  return { normalized, resolvedPath };
}

async function stageRequestedFiles(projectRoot: string, requestedFiles: string[], inputsRoot: string) {
  const stagedFiles: PythonExecStagedFile[] = [];

  for (const requestedPath of requestedFiles) {
    const { normalized, resolvedPath } = validateRequestedFilePath(projectRoot, requestedPath);
    const stat = await fs.stat(resolvedPath).catch(() => null);
    if (!stat?.isFile()) {
      throw new HttpError(404, `Python exec file "${requestedPath}" was not found.`);
    }

    const destination = path.join(inputsRoot, normalized);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(resolvedPath, destination);
    await fs.chmod(destination, 0o444).catch(() => undefined);

    stagedFiles.push({
      requestedPath: normalized,
      sandboxPath: path.posix.join('inputs', normalized.split(path.sep).join('/')),
      sizeBytes: stat.size,
    });
  }

  return stagedFiles;
}

function parseResponse(raw: string) {
  let payload: PythonExecResponse;
  try {
    payload = JSON.parse(raw) as PythonExecResponse;
  } catch {
    throw new HttpError(502, 'The local Python sandbox returned invalid JSON.');
  }

  if (
    typeof payload.exitCode !== 'number'
    || typeof payload.stdout !== 'string'
    || typeof payload.stderr !== 'string'
    || typeof payload.durationMs !== 'number'
    || !Array.isArray(payload.stagedFiles)
    || !Array.isArray(payload.generatedFiles)
    || typeof payload.stdoutTruncated !== 'boolean'
    || typeof payload.stderrTruncated !== 'boolean'
  ) {
    throw new HttpError(502, 'The local Python sandbox returned invalid execution data.');
  }

  return payload;
}

export function parsePythonExecRequest(value: unknown): PythonExecRequest {
  const record = expectRecord(value, 'Python exec request');
  const code = typeof record.code === 'string' ? record.code : '';
  const files = Array.isArray(record.files)
    ? record.files.filter((entry): entry is string => typeof entry === 'string')
    : undefined;
  const chatId = typeof record.chatId === 'string' && record.chatId.trim() ? record.chatId.trim() : undefined;

  if (!code.trim()) {
    throw new HttpError(400, 'Missing required "code" field.');
  }
  if (code.length > serverConfig.aiPythonExecMaxCodeChars) {
    throw new HttpError(400, `Python exec code exceeded ${serverConfig.aiPythonExecMaxCodeChars} characters.`);
  }
  if (files && files.length > serverConfig.aiPythonExecMaxFiles) {
    throw new HttpError(400, `Python exec supports at most ${serverConfig.aiPythonExecMaxFiles} staged files.`);
  }

  return {
    code,
    ...(files?.length ? { files } : {}),
    ...(chatId ? { chatId } : {}),
  };
}

export function runPythonExecProcess({ args, command, stdin, timeoutMs }: PythonExecRunnerInput) {
  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, `The local Python sandbox timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdin.end(stdin);
    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(new HttpError(503, `Unable to start the local Python sandbox: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new HttpError(503, stderr.join('').trim() || `The local Python sandbox exited with code ${code}.`));
        return;
      }
      resolve({ stdout: stdout.join(''), stderr: stderr.join('').trim() });
    });
  });
}

export async function runPythonExecRequest(request: PythonExecRequest, options: PythonExecServiceOptions = {}) {
  const temporaryRoot = options.sandboxRoot ? undefined : await fs.mkdtemp(path.join(os.tmpdir(), 'python-exec-'));
  const sandboxRoot = options.sandboxRoot ?? temporaryRoot!;
  const inputsRoot = options.inputsRoot ?? path.join(sandboxRoot, 'inputs');
  const workDir = options.workDir ?? path.join(sandboxRoot, 'work');
  const projectRoot = options.projectRoot ?? process.cwd();
  const runProcess = options.runProcess ?? runPythonExecProcess;

  try {
    await fs.mkdir(inputsRoot, { recursive: true });
    await fs.mkdir(workDir, { recursive: true });
    const stagedFiles = await stageRequestedFiles(projectRoot, request.files ?? [], inputsRoot);
    const { stdout } = await runProcess({
      command: serverConfig.aiPythonExecCommand,
      args: [...serverConfig.aiPythonExecArgs, sidecarScriptPath],
      timeoutMs: serverConfig.aiPythonExecTimeoutMs,
      stdin: JSON.stringify({
        code: request.code,
        generatedFilePreviewChars: Math.max(120, Math.min(2000, Math.floor(serverConfig.aiPythonExecMaxOutputChars / 4))),
        maxGeneratedFiles: Math.max(1, serverConfig.aiPythonExecMaxFiles * 4),
        outputCharLimit: serverConfig.aiPythonExecMaxOutputChars,
        sandboxRoot,
        stagedFiles,
        workDir,
      }),
    });

    const payload = parseResponse(stdout);
    if (options.chatId) {
      const previewLimit = Math.max(120, Math.min(2000, Math.floor(serverConfig.aiPythonExecMaxOutputChars / 4)));
      const maxGeneratedFiles = Math.max(1, serverConfig.aiPythonExecMaxFiles * 4);
      return {
        ...payload,
        chatId: options.chatId,
        generatedFiles: await collectGeneratedFiles(workDir, previewLimit, maxGeneratedFiles, options.chatId),
        sessionStatus: options.sessionStatus,
      };
    }
    return payload;
  } finally {
    if (!options.preserveSandbox && temporaryRoot) {
      await fs.rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export async function runPythonExecChatFallback(
  request: PythonExecRequest & { chatId: string },
  options: PythonExecServiceOptions = {},
) {
  const workspaceRoot = options.workspaceRoot ?? serverConfig.aiPythonExecWorkspaceRoot;
  const { root, inputs, work } = await ensureChatWorkspace(workspaceRoot, request.chatId);
  return runPythonExecRequest(request, {
    ...options,
    chatId: request.chatId,
    inputsRoot: inputs,
    preserveSandbox: true,
    sandboxRoot: root,
    sessionStatus: 'fallback',
    workDir: work,
  });
}
