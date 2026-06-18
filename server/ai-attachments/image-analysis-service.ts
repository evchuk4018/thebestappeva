import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AiImageAnalysisDetail, AiImageSceneGraph } from '../../shared/ai-image-bridge-contract';
import { getAttachmentSourcePath, readAttachmentRecord, saveAttachmentRecord } from './storage';
import { isStoredImageAttachmentRecord } from './record-guards';
import { analyzeImageWithSidecar } from './image-analysis-sidecar';
import { type ImageToolTelemetry, runImageToolWithRetries } from './image-tool-runtime';
import { readCachedSceneGraph, saveCachedSceneGraph, saveDebugImages } from './image-analysis-cache';
import { createImageAnalysisVisionSession, queryVisionModelJson } from './vision-model';
import { HttpError } from '../http';

const analysisVersion = 'scene-graph-v2';
type VisionLabel = { id: string; label: string; type?: string; confidence: number };
interface ImageAnalysisOptions {
  signal?: AbortSignal;
  telemetry?: ImageToolTelemetry;
  disableRetry?: boolean;
}

let testHooks: Partial<{
  analyzeFile: typeof analyzeImageWithSidecar;
  queryJson: typeof queryVisionModelJson<VisionLabel[]>;
}> = {};
const inFlightAnalyses = new Map<string, Promise<Awaited<ReturnType<typeof analyzeStoredImageCore>>>>();

function parseVisionLabels(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('Vision labels must be an array.');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Invalid vision label ${index}.`);
    }
    const record = item as Record<string, unknown>;
    return {
      id: typeof record.id === 'string' ? record.id : (() => { throw new Error('Vision label id missing.'); })(),
      label: typeof record.label === 'string' ? record.label : (() => { throw new Error('Vision label missing text.'); })(),
      type: typeof record.type === 'string' ? record.type : undefined,
      confidence: typeof record.confidence === 'number' ? record.confidence : 0.5,
    } satisfies VisionLabel;
  });
}

function getBBoxArea([left, top, right, bottom]: [number, number, number, number]) {
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function intersectBBoxes(left: [number, number, number, number], right: [number, number, number, number]) {
  const intersectWidth = Math.max(0, Math.min(left[2], right[2]) - Math.max(left[0], right[0]));
  const intersectHeight = Math.max(0, Math.min(left[3], right[3]) - Math.max(left[1], right[1]));
  return intersectWidth * intersectHeight;
}

function buildRelationships(sceneGraph: AiImageSceneGraph) {
  const relationships = [...sceneGraph.relationships];
  for (const text of sceneGraph.text) {
    if (text.objectId) {
      relationships.push({ type: 'label-for', from: text.value, to: text.objectId, confidence: text.confidence });
    }
  }
  for (let index = 0; index < sceneGraph.objects.length; index += 1) {
    const left = sceneGraph.objects[index];
    for (let rightIndex = index + 1; rightIndex < sceneGraph.objects.length; rightIndex += 1) {
      const right = sceneGraph.objects[rightIndex];
      const overlapArea = intersectBBoxes(left.bbox, right.bbox);
      if (!overlapArea) {
        continue;
      }
      const minArea = Math.max(1, Math.min(getBBoxArea(left.bbox), getBBoxArea(right.bbox)));
      const overlapRatio = overlapArea / minArea;
      if (overlapRatio > 0.85) {
        relationships.push({ type: 'contains', from: getBBoxArea(left.bbox) >= getBBoxArea(right.bbox) ? left.id : right.id, to: getBBoxArea(left.bbox) >= getBBoxArea(right.bbox) ? right.id : left.id, confidence: overlapRatio });
      } else if (overlapRatio > 0.2) {
        relationships.push({ type: 'overlaps', from: left.id, to: right.id, confidence: overlapRatio });
      }
    }
  }
  return relationships;
}

function buildLabelPrompt(sceneGraph: AiImageSceneGraph, passName: string) {
  const objects = sceneGraph.objects
    .filter((object) => passName === 'contact' || object.crops.includes(passName))
    .map(({ id, type, dominantColors }) => ({ id, type, dominantColors }));
  const text = sceneGraph.text.filter((item) => !item.objectId || objects.some((object) => object.id === item.objectId)).map(({ value, objectId }) => ({ value, objectId }));
  return [
    `You are labeling detected visual objects for the ${passName} crop of one image.`,
    'Each visible object already has a stable id. Do not invent coordinates or bounding boxes.',
    'Use the OCR text when it helps identify labels such as R1, R2, B1, or B2.',
    `Objects: ${JSON.stringify(objects)}`,
    `OCR text: ${JSON.stringify(text)}`,
    'Return a JSON array of { "id": string, "label": string, "type"?: string, "confidence": number } for visible objects only.',
  ];
}

async function applySemanticLabels(
  sceneGraph: AiImageSceneGraph,
  debugImages: Record<string, Buffer>,
  detail: AiImageAnalysisDetail,
  options: ImageAnalysisOptions = {},
) {
  const labels = new Map<string, VisionLabel>();
  let model = 'geometry-only';
  if (detail === 'layout') {
    return { model, objects: sceneGraph.objects, uncertain: sceneGraph.uncertain };
  }
  const activePasses = ['contact'].filter((passName) => {
    const image = debugImages[passName];
    return Boolean(image) && sceneGraph.objects.length > 0;
  });
  if (!activePasses.length) {
    return { model, objects: sceneGraph.objects, uncertain: sceneGraph.uncertain };
  }
  if (testHooks.queryJson) {
    for (const passName of activePasses) {
      const image = debugImages[passName];
      if (!image) {
        continue;
      }
      options.telemetry?.log('provider_request_started', { provider: 'local', model, message: `semantic:${passName}` });
      const response = await testHooks.queryJson(
        image.toString('base64'),
        buildLabelPrompt(sceneGraph, passName),
        parseVisionLabels,
        { signal: options.signal, telemetry: options.telemetry },
      );
      options.telemetry?.log('provider_response_received', { provider: 'local', model: response.model, message: `semantic:${passName}` });
      model = response.model;
      response.value.forEach((label) => {
        const current = labels.get(label.id);
        if (!current || label.confidence >= current.confidence) {
          labels.set(label.id, label);
        }
      });
    }
  } else {
    const session = await createImageAnalysisVisionSession({ signal: options.signal, telemetry: options.telemetry });
    try {
      for (const [index, passName] of activePasses.entries()) {
        const image = debugImages[passName];
        if (!image) {
          continue;
        }
        const response = await session.queryJson(
          passName,
          index === activePasses.length - 1,
          image.toString('base64'),
          buildLabelPrompt(sceneGraph, passName),
          parseVisionLabels,
        );
        model = response.model;
        response.value.forEach((label) => {
          const current = labels.get(label.id);
          if (!current || label.confidence >= current.confidence) {
            labels.set(label.id, label);
          }
        });
      }
    } finally {
      await session.dispose().catch(() => undefined);
    }
  }
  return {
    model,
    objects: sceneGraph.objects.map((object) => {
      const label = labels.get(object.id);
      return label ? { ...object, label: label.label, type: label.type || object.type, confidence: Math.max(object.confidence, label.confidence) } : object;
    }),
    uncertain: sceneGraph.uncertain.concat(
      sceneGraph.objects.filter((object) => !labels.has(object.id)).map((object) => ({
        kind: 'semantic-label' as const,
        message: `No semantic label was returned for ${object.id}.`,
        objectId: object.id,
      })),
    ),
  };
}

async function analyzeImageFromPath(filePath: string, detail: AiImageAnalysisDetail, options: ImageAnalysisOptions = {}) {
  const base = await (testHooks.analyzeFile ?? analyzeImageWithSidecar)(filePath, options);
  const labeled = await applySemanticLabels(base.sceneGraph, base.debugImages, detail, options);
  const generatedAt = new Date().toISOString();
  return {
    debugImages: base.debugImages,
    sceneGraph: {
      ...base.sceneGraph,
      objects: labeled.objects,
      relationships: buildRelationships(base.sceneGraph),
      uncertain: labeled.uncertain,
      diagnostics: {
        ...base.sceneGraph.diagnostics,
        analysisVersion,
        generatedAt,
        vlmModel: labeled.model,
        detail,
        objectCount: labeled.objects.length,
        textCount: base.sceneGraph.text.length,
      },
    } satisfies AiImageSceneGraph,
    model: labeled.model,
  };
}

async function withTempImageFile(buffer: Buffer, extension: string, action: (filePath: string) => Promise<AiImageSceneGraph>) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-image-analysis-'));
  const filePath = path.join(tempDir, `image${extension}`);
  try {
    await fs.writeFile(filePath, buffer);
    return await action(filePath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function analyzeImageBuffer(
  buffer: Buffer,
  extension = '.png',
  detail: AiImageAnalysisDetail = 'layout',
  options: ImageAnalysisOptions = {},
) {
  return withTempImageFile(buffer, extension, async (filePath) => (await analyzeImageFromPath(filePath, detail, options)).sceneGraph);
}

async function analyzeStoredImageCore(attachmentId: string, refresh = false, detail: AiImageAnalysisDetail = 'layout', options: ImageAnalysisOptions = {}) {
  const record = await readAttachmentRecord(attachmentId);
  if (!isStoredImageAttachmentRecord(record)) {
    throw new HttpError(415, `"${attachmentId}" is not an image attachment.`);
  }
  if (!refresh) {
    const cached = await readCachedSceneGraph(attachmentId, detail);
    if (cached?.sceneGraph.diagnostics.analysisVersion === analysisVersion) {
      return {
        attachment: record.attachment,
        cached: true,
        detail,
        model: cached.sceneGraph.diagnostics.vlmModel,
        sceneGraph: cached.sceneGraph,
      };
    }
  }
  const sourcePath = getAttachmentSourcePath(attachmentId, record.sourceExtension);
  const analyzed = await analyzeImageFromPath(sourcePath, detail, options);
  await saveCachedSceneGraph(attachmentId, detail, { sceneGraph: analyzed.sceneGraph });
  if (Object.keys(analyzed.debugImages).length) {
    await saveDebugImages(attachmentId, analyzed.debugImages);
  }
  const attachment = {
    ...record.attachment,
    analysisStatus: 'ready' as const,
    analysisVersion,
    analysisUpdatedAt: analyzed.sceneGraph.diagnostics.generatedAt,
  };
  await saveAttachmentRecord({ ...record, attachment });
  return { attachment, cached: false, detail, model: analyzed.model, sceneGraph: analyzed.sceneGraph };
}

export async function analyzeStoredImage(
  attachmentId: string,
  refresh = false,
  detail: AiImageAnalysisDetail = 'layout',
  options: ImageAnalysisOptions = {},
) {
  const key = `${attachmentId}:${detail}:${refresh ? 'refresh' : 'cached'}`;
  const existing = inFlightAnalyses.get(key);
  if (existing) {
    return existing;
  }
  const work = options.disableRetry
    ? analyzeStoredImageCore(attachmentId, refresh, detail, options)
    : runImageToolWithRetries(
      {
        signal: options.signal,
        telemetry: options.telemetry ?? {
          requestId: 'image-analysis',
          toolName: 'extract_image_scene',
          imageId: attachmentId,
          log() {},
          withAttempt() { return this; },
        },
        operationName: 'Image analysis',
      },
      async (attempt) => analyzeStoredImageCore(attachmentId, refresh, detail, { ...options, signal: attempt.signal, telemetry: attempt.telemetry, disableRetry: true }),
    );
  inFlightAnalyses.set(key, work);
  try {
    return await work;
  } finally {
    if (inFlightAnalyses.get(key) === work) {
      inFlightAnalyses.delete(key);
    }
  }
}

export function setImageAnalysisTestHooksForTests(hooks: typeof testHooks) {
  testHooks = hooks;
}
