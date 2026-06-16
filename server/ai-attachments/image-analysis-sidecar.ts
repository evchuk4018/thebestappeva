import path from 'node:path';
import { spawn } from 'node:child_process';
import { parseAiImageSceneGraph, type AiImageSceneGraph } from '../../shared/ai-image-scene-contract';
import { serverConfig } from '../config';
import { HttpError } from '../http';

const sidecarScriptPath = path.resolve(process.cwd(), 'python', 'image_analysis_sidecar.py');

export interface ImageAnalysisSidecarResult {
  debugImages: Record<string, Buffer>;
  sceneGraph: AiImageSceneGraph;
}

function runSidecar(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      serverConfig.aiImageAnalysisPythonCommand,
      [...serverConfig.aiImageAnalysisPythonArgs, sidecarScriptPath, ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeoutId = setTimeout(() => {
      child.kill();
      reject(new HttpError(504, `The local image-analysis sidecar timed out after ${serverConfig.aiImageAnalysisTimeoutMs}ms.`));
    }, serverConfig.aiImageAnalysisTimeoutMs);

    child.stdout.on('data', (chunk) => stdout.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(String(chunk)));
    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(new HttpError(503, `Unable to start the local image-analysis sidecar: ${error.message}`));
    });
    child.once('close', (code) => {
      clearTimeout(timeoutId);
      if (code !== 0) {
        reject(new HttpError(503, stderr.join('').trim() || `The local image-analysis sidecar exited with code ${code}.`));
        return;
      }
      resolve(stdout.join(''));
    });
  });
}

export async function analyzeImageWithSidecar(filePath: string): Promise<ImageAnalysisSidecarResult> {
  const raw = await runSidecar(['--analyze', filePath]);
  let payload: { debugImages?: Record<string, string>; sceneGraph?: AiImageSceneGraph };
  try {
    payload = JSON.parse(raw) as { debugImages?: Record<string, string>; sceneGraph?: AiImageSceneGraph };
  } catch {
    throw new HttpError(502, 'The local image-analysis sidecar returned invalid JSON.');
  }
  if (!payload.sceneGraph) {
    throw new HttpError(502, 'The local image-analysis sidecar did not return a scene graph.');
  }

  return {
    sceneGraph: parseAiImageSceneGraph(payload.sceneGraph, 'Image analysis sidecar scene graph'),
    debugImages: Object.fromEntries(
      Object.entries(payload.debugImages ?? {}).map(([name, base64Data]) => [name, Buffer.from(base64Data, 'base64')]),
    ),
  };
}
