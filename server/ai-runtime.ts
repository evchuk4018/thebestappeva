import type { Request, Response } from 'express';
import { normalizeModelProvider } from '../shared/ai-runtime-contract';
import type { AiRuntimeConfig, ModelChatMessage, ModelToolDefinition, RuntimeOptions } from '../shared/ai-runtime-contract';
import { HttpError } from './http';
import { getDefaultModelProviderId, getModelProvider, listModelProviders } from './model-providers';

function expectRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `Invalid ${field}. Expected an object.`);
  }

  return value as Record<string, unknown>;
}

function parseMessages(value: unknown) {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'Invalid request messages. Expected an array.');
  }

  return value.map((message, index) => {
    const record = expectRecord(message, `messages[${index}]`);
    const role = record.role;
    const content = record.content;
    if (
      (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool')
      || typeof content !== 'string'
    ) {
      throw new HttpError(400, `Invalid messages[${index}].`);
    }

    return record as unknown as ModelChatMessage;
  });
}

function parseTools(value: unknown) {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'Invalid request tools. Expected an array.');
  }
  return value as ModelToolDefinition[];
}

function parseRuntimeOptions(value: unknown): RuntimeOptions | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  const record = expectRecord(value, 'runtimeOptions');
  return {
    contextWindowSize: typeof record.contextWindowSize === 'number' ? record.contextWindowSize : undefined,
    maxOutputTokens: typeof record.maxOutputTokens === 'number' ? record.maxOutputTokens : undefined,
    temperature: typeof record.temperature === 'number' ? record.temperature : undefined,
  };
}

export async function buildRuntimeConfig() {
  const statuses = await Promise.all(listModelProviders().map((provider) => provider.getStatus()));
  return {
    defaultProvider: getDefaultModelProviderId(),
    providerOptions: statuses.map((status) => status.option),
    modelOptions: statuses.flatMap((status) => status.models),
  } satisfies AiRuntimeConfig;
}

function writeStreamEvent(response: Response, started: { value: boolean }, event: unknown) {
  if (!started.value) {
    started.value = true;
    response.status(200);
    response.setHeader('Content-Type', 'application/x-ndjson');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
  }

  response.write(`${JSON.stringify(event)}\n`);
}

export async function handleGetAiRuntimeConfig(_request: Request, response: Response) {
  response.status(200).json(await buildRuntimeConfig());
}

export async function handleGetAiModelCapabilities(request: Request, response: Response) {
  const provider = normalizeModelProvider(request.query.provider);
  const model = typeof request.query.model === 'string' ? request.query.model.trim() : '';
  if (!model) {
    throw new HttpError(400, 'Missing required "model" query parameter.');
  }

  response.status(200).json({ capabilities: await getModelProvider(provider).getCapabilities(model) });
}

export async function handlePostAiChatStream(request: Request, response: Response) {
  const body = expectRecord(request.body, 'AI chat request');
  const provider = normalizeModelProvider(body.provider);
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : '';
  if (!model) {
    throw new HttpError(400, 'Missing required "model" field.');
  }

  const started = { value: false };
  let sawContent = false;
  let sawThinking = false;
  let sawToolCalls = false;

  try {
    const result = await getModelProvider(provider).callChatStream({
      model,
      messages: parseMessages(body.messages),
      think: Boolean(body.think),
      tools: parseTools(body.tools),
      runtimeOptions: parseRuntimeOptions(body.runtimeOptions),
      onEvent: (event) => {
        if (event.type === 'content') sawContent = true;
        if (event.type === 'thinking') sawThinking = true;
        if (event.type === 'tool-calls') sawToolCalls = true;
        writeStreamEvent(response, started, event);
      },
    });

    if (result.thinking && !sawThinking) {
      writeStreamEvent(response, started, { type: 'thinking', delta: result.thinking, snapshot: result.thinking, model: result.model });
    }
    if (result.content && !sawContent) {
      writeStreamEvent(response, started, { type: 'content', delta: result.content, snapshot: result.content, model: result.model });
    }
    if (result.toolCalls?.length && !sawToolCalls) {
      writeStreamEvent(response, started, { type: 'tool-calls', toolCalls: result.toolCalls, model: result.model });
    }
    writeStreamEvent(response, started, { type: 'done', model: result.model });
    response.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to complete the AI request.';
    if (!started.value) {
      response.status(error instanceof HttpError ? error.statusCode : 500).json({ ok: false, error: message });
      return;
    }

    writeStreamEvent(response, started, { type: 'error', error: message });
    response.end();
  }
}
