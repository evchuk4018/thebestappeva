export interface AiImageSceneCanvas {
  width: number;
  height: number;
  background: string;
}

export interface AiImageSceneObject {
  id: string;
  type: string;
  label?: string;
  role?: string;
  parentId?: string;
  zIndex?: number;
  source?: string;
  bbox: [number, number, number, number];
  polygon?: number[][];
  line?: [number, number, number, number];
  dominantColors: string[];
  fill?: string;
  stroke?: string;
  crops: string[];
  confidence: number;
}

export interface AiImageSceneText {
  value: string;
  bbox: [number, number, number, number];
  confidence: number;
  objectId?: string;
}

export interface AiImageSceneRelationship {
  type: 'contains' | 'overlaps' | 'label-for';
  from: string;
  to: string;
  confidence: number;
}

export interface AiImageSceneUncertain {
  kind: 'object' | 'text' | 'relationship' | 'semantic-label';
  message: string;
  objectId?: string;
  textValue?: string;
}

export interface AiImageSceneDiagnostics {
  analysisVersion: string;
  generatedAt: string;
  ocrEngine: string;
  vlmModel: string;
  passes: string[];
  detail?: 'layout' | 'semantic';
  timingsMs?: Record<string, number>;
  objectCount?: number;
  textCount?: number;
}

export interface AiImageSceneGraph {
  canvas: AiImageSceneCanvas;
  objects: AiImageSceneObject[];
  text: AiImageSceneText[];
  relationships: AiImageSceneRelationship[];
  uncertain: AiImageSceneUncertain[];
  diagnostics: AiImageSceneDiagnostics;
}

export interface AiImageComparisonIssue {
  kind: 'missing-object' | 'extra-object' | 'moved-object' | 'text-mismatch' | 'color-mismatch';
  sourceId?: string;
  targetId?: string;
  message: string;
  confidence: number;
}

export interface AiImageComparisonResult {
  format: 'svg';
  source: AiImageSceneGraph;
  target: AiImageSceneGraph;
  pixelSimilarity: number;
  issues: AiImageComparisonIssue[];
  recommendedPatches: string[];
  iterationBudget: {
    current: number;
    max: number;
    shouldContinue: boolean;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function expectRecord(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }
  return value;
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}. Expected a string.`);
  }
  return value;
}

function expectNumber(value: unknown, field: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}. Expected a finite number.`);
  }
  return value;
}

function expectStringArray(value: unknown, field: string) {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}. Expected an array.`);
  }
  return value.map((item, index) => expectString(item, `${field}[${index}]`));
}

function expectNumberTuple(value: unknown, field: string): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new Error(`Invalid ${field}. Expected a 4-item array.`);
  }
  return [
    expectNumber(value[0], `${field}[0]`),
    expectNumber(value[1], `${field}[1]`),
    expectNumber(value[2], `${field}[2]`),
    expectNumber(value[3], `${field}[3]`),
  ];
}

function parsePolygon(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}. Expected an array.`);
  }
  return value.map((point, index) => {
    if (!Array.isArray(point) || point.length !== 2) {
      throw new Error(`Invalid ${field}[${index}]. Expected a 2-item array.`);
    }
    return [expectNumber(point[0], `${field}[${index}][0]`), expectNumber(point[1], `${field}[${index}][1]`)] as [number, number];
  });
}

function parseOptionalString(value: unknown, field: string) {
  return typeof value === 'undefined' ? undefined : expectString(value, field);
}

function parseOptionalNumber(value: unknown, field: string) {
  return typeof value === 'undefined' ? undefined : expectNumber(value, field);
}

function parseOptionalStringRecord(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  const record = expectRecord(value, field);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, expectNumber(item, `${field}.${key}`)]),
  );
}

function parseOptionalDetail(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  const detail = expectString(value, field);
  if (detail !== 'layout' && detail !== 'semantic') {
    throw new Error(`Invalid ${field}. Expected "layout" or "semantic".`);
  }
  return detail;
}

function parseObject(value: unknown, field: string): AiImageSceneObject {
  const record = expectRecord(value, field);
  return {
    id: expectString(record.id, `${field}.id`),
    type: expectString(record.type, `${field}.type`),
    label: parseOptionalString(record.label, `${field}.label`),
    role: parseOptionalString(record.role, `${field}.role`),
    parentId: parseOptionalString(record.parentId, `${field}.parentId`),
    zIndex: parseOptionalNumber(record.zIndex, `${field}.zIndex`),
    source: parseOptionalString(record.source, `${field}.source`),
    bbox: expectNumberTuple(record.bbox, `${field}.bbox`),
    polygon: parsePolygon(record.polygon, `${field}.polygon`),
    line: typeof record.line === 'undefined' ? undefined : expectNumberTuple(record.line, `${field}.line`),
    dominantColors: expectStringArray(record.dominantColors, `${field}.dominantColors`),
    fill: parseOptionalString(record.fill, `${field}.fill`),
    stroke: parseOptionalString(record.stroke, `${field}.stroke`),
    crops: expectStringArray(record.crops, `${field}.crops`),
    confidence: expectNumber(record.confidence, `${field}.confidence`),
  };
}

function parseText(value: unknown, field: string): AiImageSceneText {
  const record = expectRecord(value, field);
  return {
    value: expectString(record.value, `${field}.value`),
    bbox: expectNumberTuple(record.bbox, `${field}.bbox`),
    confidence: expectNumber(record.confidence, `${field}.confidence`),
    objectId: parseOptionalString(record.objectId, `${field}.objectId`),
  };
}

function parseRelationship(value: unknown, field: string): AiImageSceneRelationship {
  const record = expectRecord(value, field);
  const type = expectString(record.type, `${field}.type`);
  if (type !== 'contains' && type !== 'overlaps' && type !== 'label-for') {
    throw new Error(`Invalid ${field}.type. Expected "contains", "overlaps", or "label-for".`);
  }
  return {
    type,
    from: expectString(record.from, `${field}.from`),
    to: expectString(record.to, `${field}.to`),
    confidence: expectNumber(record.confidence, `${field}.confidence`),
  };
}

function parseUncertain(value: unknown, field: string): AiImageSceneUncertain {
  const record = expectRecord(value, field);
  const kind = expectString(record.kind, `${field}.kind`);
  if (kind !== 'object' && kind !== 'text' && kind !== 'relationship' && kind !== 'semantic-label') {
    throw new Error(`Invalid ${field}.kind.`);
  }
  return {
    kind,
    message: expectString(record.message, `${field}.message`),
    objectId: parseOptionalString(record.objectId, `${field}.objectId`),
    textValue: parseOptionalString(record.textValue, `${field}.textValue`),
  };
}

export function parseAiImageSceneGraph(value: unknown, field = 'AI image scene graph'): AiImageSceneGraph {
  const record = expectRecord(value, field);
  const canvas = expectRecord(record.canvas, `${field}.canvas`);
  const diagnostics = expectRecord(record.diagnostics, `${field}.diagnostics`);
  return {
    canvas: {
      width: expectNumber(canvas.width, `${field}.canvas.width`),
      height: expectNumber(canvas.height, `${field}.canvas.height`),
      background: expectString(canvas.background, `${field}.canvas.background`),
    },
    objects: Array.isArray(record.objects) ? record.objects.map((item, index) => parseObject(item, `${field}.objects[${index}]`)) : [],
    text: Array.isArray(record.text) ? record.text.map((item, index) => parseText(item, `${field}.text[${index}]`)) : [],
    relationships: Array.isArray(record.relationships)
      ? record.relationships.map((item, index) => parseRelationship(item, `${field}.relationships[${index}]`))
      : [],
    uncertain: Array.isArray(record.uncertain)
      ? record.uncertain.map((item, index) => parseUncertain(item, `${field}.uncertain[${index}]`))
      : [],
    diagnostics: {
      analysisVersion: expectString(diagnostics.analysisVersion, `${field}.diagnostics.analysisVersion`),
      generatedAt: expectString(diagnostics.generatedAt, `${field}.diagnostics.generatedAt`),
      ocrEngine: expectString(diagnostics.ocrEngine, `${field}.diagnostics.ocrEngine`),
      vlmModel: expectString(diagnostics.vlmModel, `${field}.diagnostics.vlmModel`),
      passes: expectStringArray(diagnostics.passes, `${field}.diagnostics.passes`),
      detail: parseOptionalDetail(diagnostics.detail, `${field}.diagnostics.detail`),
      timingsMs: parseOptionalStringRecord(diagnostics.timingsMs, `${field}.diagnostics.timingsMs`),
      objectCount: parseOptionalNumber(diagnostics.objectCount, `${field}.diagnostics.objectCount`),
      textCount: parseOptionalNumber(diagnostics.textCount, `${field}.diagnostics.textCount`),
    },
  };
}

export function parseAiImageComparisonResult(value: unknown, field = 'AI image comparison result'): AiImageComparisonResult {
  const record = expectRecord(value, field);
  const format = expectString(record.format, `${field}.format`);
  if (format !== 'svg') {
    throw new Error(`Invalid ${field}.format. Expected "svg".`);
  }
  const budget = expectRecord(record.iterationBudget, `${field}.iterationBudget`);
  return {
    format,
    source: parseAiImageSceneGraph(record.source, `${field}.source`),
    target: parseAiImageSceneGraph(record.target, `${field}.target`),
    pixelSimilarity: expectNumber(record.pixelSimilarity, `${field}.pixelSimilarity`),
    issues: Array.isArray(record.issues)
      ? record.issues.map((item, index) => {
          const issue = expectRecord(item, `${field}.issues[${index}]`);
          const kind = expectString(issue.kind, `${field}.issues[${index}].kind`);
          if (!['missing-object', 'extra-object', 'moved-object', 'text-mismatch', 'color-mismatch'].includes(kind)) {
            throw new Error(`Invalid ${field}.issues[${index}].kind.`);
          }
          return {
            kind: kind as AiImageComparisonIssue['kind'],
            sourceId: parseOptionalString(issue.sourceId, `${field}.issues[${index}].sourceId`),
            targetId: parseOptionalString(issue.targetId, `${field}.issues[${index}].targetId`),
            message: expectString(issue.message, `${field}.issues[${index}].message`),
            confidence: expectNumber(issue.confidence, `${field}.issues[${index}].confidence`),
          };
        })
      : [],
    recommendedPatches: expectStringArray(record.recommendedPatches, `${field}.recommendedPatches`),
    iterationBudget: {
      current: expectNumber(budget.current, `${field}.iterationBudget.current`),
      max: expectNumber(budget.max, `${field}.iterationBudget.max`),
      shouldContinue: Boolean(budget.shouldContinue),
    },
  };
}
