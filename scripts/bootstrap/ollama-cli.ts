import { access } from 'node:fs/promises';
import path from 'node:path';
import type { BootstrapLogger } from './log';
import { isCommandAvailable, runStreamingCommand } from './process';

const defaultInstallDir = path.join('.local-bin', 'ollama');

function getWorkspaceInstallDir() {
  const configuredDir = process.env.OLLAMA_INSTALL_DIR?.trim();
  return path.resolve(process.cwd(), configuredDir?.length ? configuredDir : defaultInstallDir);
}

function getWorkspaceExecutablePath() {
  const executableName = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
  return path.join(getWorkspaceInstallDir(), executableName);
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function ensureWorkspacePathInSession() {
  const installDir = getWorkspaceInstallDir();
  const currentPath = process.env.PATH ?? '';
  const pathEntries = currentPath.split(path.delimiter).filter(Boolean);
  if (pathEntries.includes(installDir)) {
    return;
  }

  process.env.PATH = [installDir, ...pathEntries].join(path.delimiter);
}

function getPowerShellExecutable() {
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  return path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

function escapePowerShellSingleQuotedValue(value: string) {
  return value.replace(/'/g, "''");
}

async function installWorkspaceOllama(logger: BootstrapLogger) {
  if (process.platform !== 'win32') {
    throw new Error('Automatic repo-local Ollama installation is currently only implemented for Windows.');
  }

  const installDir = getWorkspaceInstallDir();
  logger.step(`Installing Ollama into ${path.relative(process.cwd(), installDir) || installDir}...`);

  await runStreamingCommand(getPowerShellExecutable(), [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; $env:OLLAMA_INSTALL_DIR='${escapePowerShellSingleQuotedValue(installDir)}'; irm https://ollama.com/install.ps1 | iex`,
  ]);

  const executablePath = getWorkspaceExecutablePath();
  if (!(await pathExists(executablePath))) {
    throw new Error(`Ollama install finished, but ${executablePath} was not created.`);
  }

  ensureWorkspacePathInSession();
  return executablePath;
}

export function getWorkspaceOllamaInstallDir() {
  return getWorkspaceInstallDir();
}

export async function ensureOllamaCommand(logger: BootstrapLogger) {
  const executablePath = getWorkspaceExecutablePath();
  if (await pathExists(executablePath)) {
    ensureWorkspacePathInSession();
    return executablePath;
  }

  if (process.platform !== 'win32' && (await isCommandAvailable('ollama'))) {
    return 'ollama';
  }

  return installWorkspaceOllama(logger);
}
