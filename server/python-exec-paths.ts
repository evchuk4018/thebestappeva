import fs from 'node:fs/promises';
import path from 'node:path';
import type { PythonExecGeneratedFile, PythonExecGeneratedFileKind, PythonExecStagedFile } from '../shared/ai-python-exec-contract';
import { HttpError } from './http';

const blockedRoots = new Set(['.git', '.local-data', '.vite', 'dist', 'node_modules']);

export function normalizeRequestedPath(value: string) {
  return value.replace(/\\/g, '/').trim();
}

function buildSandboxError(message: string) {
  return new HttpError(400, message);
}

export function validateRequestedFilePath(projectRoot: string, requestedPath: string) {
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

export function validateWorkspaceRelativePath(workspaceRoot: string, chatId: string, relativePath: string) {
  const normalized = normalizeRequestedPath(relativePath);
  if (!normalized || path.posix.isAbsolute(normalized) || path.win32.isAbsolute(normalized)) {
    throw buildSandboxError('Generated file paths must be relative to the chat workspace.');
  }
  const chatRoot = path.resolve(workspaceRoot, chatId);
  const resolved = path.resolve(chatRoot, 'work', normalized);
  const relativeToWork = path.relative(path.join(chatRoot, 'work'), resolved);
  if (!relativeToWork || relativeToWork.startsWith('..') || path.isAbsolute(relativeToWork)) {
    throw buildSandboxError('Generated file paths must stay inside the chat workspace.');
  }
  return resolved;
}

export function chatWorkspaceRoot(workspaceRoot: string, chatId: string) {
  return path.resolve(workspaceRoot, chatId);
}

export async function ensureChatWorkspace(workspaceRoot: string, chatId: string) {
  const root = chatWorkspaceRoot(workspaceRoot, chatId);
  const inputs = path.join(root, 'inputs');
  const work = path.join(root, 'work');
  await fs.mkdir(inputs, { recursive: true });
  await fs.mkdir(work, { recursive: true });
  return { root, inputs, work };
}

export async function deleteChatWorkspace(workspaceRoot: string, chatId: string) {
  await fs.rm(chatWorkspaceRoot(workspaceRoot, chatId), { recursive: true, force: true }).catch(() => undefined);
}

export async function stageRequestedFiles(
  projectRoot: string,
  requestedFiles: string[],
  inputsRoot: string,
) {
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

const mediaTypeByExtension: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  json: 'application/json',
  txt: 'text/plain',
  md: 'text/markdown',
  html: 'text/html',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const imageExtensions = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp']);
const textExtensions = new Set(['csv', 'tsv', 'json', 'txt', 'md', 'html', 'log']);

export function detectFileKind(relativePath: string): PythonExecGeneratedFileKind {
  const ext = relativePath.split('.').pop()?.toLowerCase() ?? '';
  if (imageExtensions.has(ext)) {
    return 'image';
  }
  if (textExtensions.has(ext)) {
    return 'text';
  }
  return 'binary';
}

export function detectMediaType(relativePath: string) {
  const ext = relativePath.split('.').pop()?.toLowerCase() ?? '';
  return mediaTypeByExtension[ext];
}

export function buildDownloadUrl(chatId: string, relativePath: string) {
  return `/api/ai/chats/${encodeURIComponent(chatId)}/python-exec/files/${relativePath.split(path.sep).join('/')}`;
}

export async function collectGeneratedFiles(workDir: string, previewLimit: number, maxFiles: number, chatId: string) {
  const collected: PythonExecGeneratedFile[] = [];
  let entries: string[] = [];
  try {
    for await (const candidate of walkFiles(workDir)) {
      entries.push(candidate);
    }
  } catch {
    entries = [];
  }
  entries.sort();
  for (const absolutePath of entries) {
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
      continue;
    }
    const relative = path.relative(workDir, absolutePath).split(path.sep).join('/');
    const kind = detectFileKind(relative);
    let preview = '';
    let truncated = false;
    if (kind === 'text') {
      try {
        const text = await fs.readFile(absolutePath, 'utf8');
        if (text.length <= previewLimit) {
          preview = text;
        } else {
          preview = text.slice(0, previewLimit);
          truncated = true;
        }
      } catch {
        preview = '';
      }
    }
    collected.push({
      path: relative,
      sizeBytes: stat.size,
      preview,
      truncated,
      kind,
      mediaType: detectMediaType(relative),
      downloadUrl: buildDownloadUrl(chatId, relative),
    });
    if (collected.length >= maxFiles) {
      break;
    }
  }
  return collected;
}

async function* walkFiles(dir: string): AsyncIterable<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}