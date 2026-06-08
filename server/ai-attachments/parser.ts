import path from 'node:path';
import { spawn } from 'node:child_process';
import { HttpError } from '../http';
import { serverConfig } from '../config';
import { ParsedDocumentPayload } from './types';

const parserScriptPath = path.resolve(process.cwd(), 'python', 'docling_sidecar.py');

function runParserCommand(args: string[]) {
  return new Promise<{ stderr: string; stdout: string }>((resolve, reject) => {
    const child = spawn(serverConfig.aiParserPythonCommand, [...serverConfig.aiParserPythonArgs, parserScriptPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, `The local Docling parser timed out after ${serverConfig.aiParserTimeoutMs}ms.`));
    }, serverConfig.aiParserTimeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(new HttpError(503, `Unable to start the local Docling parser: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new HttpError(503, (stderr.join('').trim() || `The local Docling parser exited with code ${code}.`).trim()));
        return;
      }

      resolve({ stdout: stdout.join(''), stderr: stderr.join('').trim() });
    });
  });
}

function parseJson<T>(raw: string, fallback: string) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(502, fallback);
  }
}

export async function readParserHealth() {
  const { stdout } = await runParserCommand(['--health']);
  return parseJson<{ available: boolean; details?: string; message: string; parser: 'docling' }>(
    stdout,
    'The local Docling parser returned invalid health data.',
  );
}

export async function parseDocumentWithDocling(filePath: string) {
  const { stdout } = await runParserCommand(['--parse', filePath]);
  return parseJson<ParsedDocumentPayload>(stdout, 'The local Docling parser returned invalid document data.');
}
