import fs from 'node:fs/promises';
import path from 'node:path';
import type { AiImageSceneGraph } from '../../shared/ai-image-bridge-contract';
import { serverConfig } from '../config';
import type { AiImageAnalysisDetail } from '../../shared/ai-image-bridge-contract';

export interface StoredImageSceneGraphCache {
  sceneGraph: AiImageSceneGraph;
}

function getAnalysisDir(attachmentId: string) {
  return path.join(serverConfig.aiAttachmentStoragePath, `${attachmentId}-image-analysis`);
}

function getSceneGraphPath(attachmentId: string, detail: AiImageAnalysisDetail) {
  return path.join(getAnalysisDir(attachmentId), `scene-graph-${detail}.json`);
}

export function getDebugImagePath(attachmentId: string, name: string) {
  return path.join(getAnalysisDir(attachmentId), `${name}.png`);
}

export async function readCachedSceneGraph(attachmentId: string, detail: AiImageAnalysisDetail) {
  try {
    const raw = await fs.readFile(getSceneGraphPath(attachmentId, detail), 'utf8');
    return JSON.parse(raw) as StoredImageSceneGraphCache;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function saveCachedSceneGraph(attachmentId: string, detail: AiImageAnalysisDetail, payload: StoredImageSceneGraphCache) {
  await fs.mkdir(getAnalysisDir(attachmentId), { recursive: true });
  await fs.writeFile(getSceneGraphPath(attachmentId, detail), JSON.stringify(payload, null, 2), 'utf8');
}

export async function saveDebugImages(attachmentId: string, images: Record<string, Buffer>) {
  await fs.mkdir(getAnalysisDir(attachmentId), { recursive: true });
  await Promise.all(
    Object.entries(images).map(([name, buffer]) => fs.writeFile(getDebugImagePath(attachmentId, name), buffer)),
  );
}

export async function deleteImageAnalysisCache(attachmentId: string) {
  await fs.rm(getAnalysisDir(attachmentId), { recursive: true, force: true }).catch(() => undefined);
}
