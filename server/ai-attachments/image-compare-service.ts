import fs from 'node:fs/promises';
import sharp from 'sharp';
import type { AiImageComparisonIssue, AiImageComparisonResult, AiImageSceneGraph, AiImageSceneObject } from '../../shared/ai-image-bridge-contract';
import { HttpError } from '../http';
import type { ImageToolTelemetry } from './image-tool-runtime';
import { analyzeImageBuffer, analyzeStoredImage } from './image-analysis-service';
import { getAttachmentSourcePath, readAttachmentRecord } from './storage';
import { isStoredImageAttachmentRecord } from './record-guards';

let renderSvgHook: ((content: string) => Promise<Buffer>) | null = null;

function bboxArea([left, top, right, bottom]: [number, number, number, number]) {
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function computeIoU(left: [number, number, number, number], right: [number, number, number, number]) {
  const overlapWidth = Math.max(0, Math.min(left[2], right[2]) - Math.max(left[0], right[0]));
  const overlapHeight = Math.max(0, Math.min(left[3], right[3]) - Math.max(left[1], right[1]));
  const overlap = overlapWidth * overlapHeight;
  if (!overlap) {
    return 0;
  }
  return overlap / Math.max(1, bboxArea(left) + bboxArea(right) - overlap);
}

function aspectRatio([left, top, right, bottom]: [number, number, number, number]) {
  return Math.max(1, right - left) / Math.max(1, bottom - top);
}

function objectTextValues(scene: AiImageSceneGraph, objectId: string) {
  return scene.text
    .filter((item) => item.objectId === objectId)
    .map((item) => item.value.trim().toLowerCase())
    .filter(Boolean);
}

function textOverlap(source: AiImageSceneGraph, target: AiImageSceneGraph, sourceId: string, targetId: string) {
  const targetValues = new Set(objectTextValues(target, targetId));
  return objectTextValues(source, sourceId).some((value) => targetValues.has(value)) ? 0.35 : 0;
}

function objectScore(sourceScene: AiImageSceneGraph, targetScene: AiImageSceneGraph, source: AiImageSceneObject, target: AiImageSceneObject) {
  const iou = computeIoU(source.bbox, target.bbox);
  const labelMatch = source.label && target.label && source.label.toLowerCase() === target.label.toLowerCase() ? 0.45 : 0;
  const roleMatch = source.role && target.role && source.role === target.role ? 0.25 : 0;
  const typeMatch = source.type === target.type ? 0.16 : 0;
  const colorMatch = source.dominantColors[0] && source.dominantColors[0] === target.dominantColors[0] ? 0.12 : 0;
  const ratioDelta = Math.abs(aspectRatio(source.bbox) - aspectRatio(target.bbox));
  const ratioMatch = ratioDelta < 0.4 ? 0.12 : 0;
  return iou * 1.1 + labelMatch + roleMatch + typeMatch + colorMatch + ratioMatch + textOverlap(sourceScene, targetScene, source.id, target.id);
}

function compareObjects(source: AiImageSceneGraph, target: AiImageSceneGraph) {
  const issues: AiImageComparisonIssue[] = [];
  const matchedTargetIds = new Set<string>();
  for (const sourceObject of source.objects) {
    let best: { object: AiImageSceneObject; score: number } | null = null;
    for (const targetObject of target.objects.filter((candidate) => !matchedTargetIds.has(candidate.id))) {
      const score = objectScore(source, target, sourceObject, targetObject);
      if (!best || score > best.score) {
        best = { object: targetObject, score };
      }
    }
    if (!best || best.score < 0.35) {
      issues.push({ kind: 'missing-object', sourceId: sourceObject.id, message: `Missing object ${sourceObject.label || sourceObject.id}.`, confidence: 0.9 });
      continue;
    }
    matchedTargetIds.add(best.object.id);
    const iou = computeIoU(sourceObject.bbox, best.object.bbox);
    if (iou < 0.45) {
      issues.push({ kind: 'moved-object', sourceId: sourceObject.id, targetId: best.object.id, message: `Object ${sourceObject.label || sourceObject.id} is misplaced.`, confidence: 1 - iou });
    }
    if (sourceObject.dominantColors[0] && best.object.dominantColors[0] && sourceObject.dominantColors[0] !== best.object.dominantColors[0]) {
      issues.push({ kind: 'color-mismatch', sourceId: sourceObject.id, targetId: best.object.id, message: `Object ${sourceObject.label || sourceObject.id} has the wrong dominant color.`, confidence: 0.7 });
    }
  }
  target.objects.filter((object) => !matchedTargetIds.has(object.id)).forEach((object) => {
    issues.push({ kind: 'extra-object', targetId: object.id, message: `Extra object ${object.label || object.id} appears in the render.`, confidence: 0.7 });
  });
  return issues;
}

function compareText(source: AiImageSceneGraph, target: AiImageSceneGraph) {
  const issues: AiImageComparisonIssue[] = [];
  const targetValues = new Set(target.text.map((item) => item.value.toLowerCase()));
  source.text.forEach((item) => {
    if (!targetValues.has(item.value.toLowerCase())) {
      issues.push({ kind: 'text-mismatch', message: `Missing or incorrect text "${item.value}".`, confidence: 0.9 });
    }
  });
  return issues;
}

async function computePixelSimilarity(sourceBuffer: Buffer, targetBuffer: Buffer) {
  const width = 256;
  const height = 256;
  const [left, right] = await Promise.all([
    sharp(sourceBuffer).resize(width, height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }),
    sharp(targetBuffer).resize(width, height, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true }),
  ]);
  let diff = 0;
  for (let index = 0; index < Math.min(left.data.length, right.data.length); index += 1) {
    diff += Math.abs(left.data[index] - right.data[index]);
  }
  const maxDiff = Math.max(1, Math.min(left.data.length, right.data.length) * 255);
  return Math.max(0, Math.min(1, 1 - diff / maxDiff));
}

async function renderSvgToPng(content: string) {
  try {
    return await (renderSvgHook ? renderSvgHook(content) : sharp(Buffer.from(content, 'utf8')).png().toBuffer());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render SVG.';
    throw new HttpError(400, message);
  }
}

function buildPatchHints(issues: AiImageComparisonIssue[]) {
  return issues.slice(0, 6).map((issue) => {
    switch (issue.kind) {
      case 'missing-object':
        return `Add the missing source object ${issue.sourceId}.`;
      case 'moved-object':
        return `Move ${issue.sourceId} closer to the source layout.`;
      case 'color-mismatch':
        return `Correct the fill or stroke colors for ${issue.sourceId}.`;
      case 'text-mismatch':
        return issue.message;
      default:
        return issue.message;
    }
  });
}

export async function compareGeneratedImage(args: {
  attachmentId: string;
  content: string;
  format: 'svg';
  iteration?: number;
  maxIterations?: number;
  refresh?: boolean;
  signal?: AbortSignal;
  telemetry?: ImageToolTelemetry;
}) {
  const sourceRecord = await analyzeStoredImage(args.attachmentId, args.refresh, 'layout', { signal: args.signal, telemetry: args.telemetry });
  const storedRecord = await readAttachmentRecord(args.attachmentId);
  if (!isStoredImageAttachmentRecord(storedRecord)) {
    throw new HttpError(415, `"${args.attachmentId}" is not an image attachment.`);
  }
  const sourceBuffer = await fs.readFile(getAttachmentSourcePath(args.attachmentId, storedRecord.sourceExtension));
  const renderedPng = await renderSvgToPng(args.content);
  const targetScene = await analyzeImageBuffer(renderedPng, '.png', 'layout', { signal: args.signal, telemetry: args.telemetry, disableRetry: true });
  const issues = [...compareObjects(sourceRecord.sceneGraph, targetScene), ...compareText(sourceRecord.sceneGraph, targetScene)];
  const pixelSimilarity = await computePixelSimilarity(sourceBuffer, renderedPng).catch(() => 0);
  const current = Math.max(1, args.iteration ?? 1);
  const max = Math.max(current, args.maxIterations ?? 3);
  return {
    attachment: sourceRecord.attachment,
    cached: sourceRecord.cached,
    comparison: {
      format: 'svg',
      source: sourceRecord.sceneGraph,
      target: targetScene,
      pixelSimilarity,
      issues,
      recommendedPatches: buildPatchHints(issues),
      iterationBudget: {
        current,
        max,
        shouldContinue: issues.length > 0 && current < max,
      },
    } satisfies AiImageComparisonResult,
  };
}

export function setRenderSvgHookForTests(hook: typeof renderSvgHook) {
  renderSvgHook = hook;
}
