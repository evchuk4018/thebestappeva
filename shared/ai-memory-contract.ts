export interface AiMemoryRefreshResponse {
  chatId: string;
  generatedUserMemory: string;
  summary: string;
  summaryUpdatedAt: string | null;
  memoryUpdated: boolean;
  summaryUpdated: boolean;
  memoryError?: string;
  summaryError?: string;
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

function expectBoolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid ${field}. Expected a boolean.`);
  }

  return value;
}

function expectOptionalString(value: unknown, field: string) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  return value === null ? null : expectString(value, field);
}

export function parseAiMemoryRefreshResponse(value: unknown, field = 'AI memory refresh response'): AiMemoryRefreshResponse {
  const record = expectRecord(value, field);
  return {
    chatId: expectString(record.chatId, `${field}.chatId`),
    generatedUserMemory: expectString(record.generatedUserMemory, `${field}.generatedUserMemory`),
    summary: expectString(record.summary, `${field}.summary`),
    summaryUpdatedAt: expectOptionalString(record.summaryUpdatedAt, `${field}.summaryUpdatedAt`) ?? null,
    memoryUpdated: expectBoolean(record.memoryUpdated, `${field}.memoryUpdated`),
    summaryUpdated: expectBoolean(record.summaryUpdated, `${field}.summaryUpdated`),
    memoryError: expectOptionalString(record.memoryError, `${field}.memoryError`) ?? undefined,
    summaryError: expectOptionalString(record.summaryError, `${field}.summaryError`) ?? undefined,
  };
}
