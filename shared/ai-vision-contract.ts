export type AiVisionMode = 'offline' | 'online';
export type AiVisionProvider = 'local' | 'gemini';

export interface AiVisionMetadata {
  mode: AiVisionMode;
  provider: AiVisionProvider;
  model: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  notice?: string;
}

function expectRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${field}. Expected an object.`);
  }
  return value as Record<string, unknown>;
}

function expectString(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}. Expected a string.`);
  }
  return value;
}

function expectOptionalString(value: unknown, field: string) {
  return typeof value === 'undefined' ? undefined : expectString(value, field);
}

function expectOptionalNumber(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}. Expected a finite number.`);
  }
  return value;
}

export function normalizeVisionMode(value: unknown, fallback: AiVisionMode = 'offline'): AiVisionMode {
  return value === 'online' ? 'online' : value === 'offline' ? 'offline' : fallback;
}

export function parseAiVisionMetadata(value: unknown, field = 'AI vision metadata'): AiVisionMetadata {
  const record = expectRecord(value, field);
  const provider = expectString(record.provider, `${field}.provider`);
  if (provider !== 'local' && provider !== 'gemini') {
    throw new Error(`Invalid ${field}.provider. Expected "local" or "gemini".`);
  }
  return {
    mode: normalizeVisionMode(record.mode),
    provider,
    model: expectString(record.model, `${field}.model`),
    fallbackUsed: Boolean(record.fallbackUsed),
    fallbackReason: expectOptionalString(record.fallbackReason, `${field}.fallbackReason`),
    latencyMs: expectOptionalNumber(record.latencyMs, `${field}.latencyMs`) ?? 0,
    inputTokens: expectOptionalNumber(record.inputTokens, `${field}.inputTokens`),
    outputTokens: expectOptionalNumber(record.outputTokens, `${field}.outputTokens`),
    totalTokens: expectOptionalNumber(record.totalTokens, `${field}.totalTokens`),
    estimatedCostUsd: expectOptionalNumber(record.estimatedCostUsd, `${field}.estimatedCostUsd`),
    notice: expectOptionalString(record.notice, `${field}.notice`),
  };
}
