import type { Request, Response } from 'express';
import { ArtifactContextMode, UpdateArtifactRequest, UpdateArtifactTableRequest } from '../shared/ai-artifacts-contract';
import { aiArtifactsRepository } from './db/ai-artifacts-repository';
import { HttpError, getOptionalIntParam, getOptionalQueryParam } from './http';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function expectBody(request: Request) {
  if (!request.body || typeof request.body !== 'object') {
    throw new HttpError(400, 'Missing request body.');
  }
  return request.body as Record<string, unknown>;
}

function parseContextPolicy(value: unknown) {
  if (!value || typeof value !== 'object') return { mode: 'chunked' as const };
  const record = value as Record<string, unknown>;
  const mode = (typeof record.mode === 'string' ? record.mode : 'chunked') as ArtifactContextMode;
  return {
    mode,
    maxChars: typeof record.maxChars === 'number' ? record.maxChars : undefined,
    chunkSize: typeof record.chunkSize === 'number' ? record.chunkSize : undefined,
    overlap: typeof record.overlap === 'number' ? record.overlap : undefined,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
  };
}

function parseUpdateArtifactRequest(body: Record<string, unknown>): UpdateArtifactRequest {
  return {
    artifactId: String(body.artifactId ?? ''),
    title: typeof body.title === 'string' ? body.title : undefined,
    type: typeof body.type === 'string' ? body.type : undefined,
    contextPolicy: body.contextPolicy && typeof body.contextPolicy === 'object' ? parseContextPolicy(body.contextPolicy) : undefined,
    content: typeof body.content === 'string' ? body.content : undefined,
    patch: body.patch && typeof body.patch === 'object'
      ? {
          mode: String((body.patch as Record<string, unknown>).mode) as UpdateArtifactRequest['patch']['mode'],
          startLine: typeof (body.patch as Record<string, unknown>).startLine === 'number' ? Number((body.patch as Record<string, unknown>).startLine) : undefined,
          endLine: typeof (body.patch as Record<string, unknown>).endLine === 'number' ? Number((body.patch as Record<string, unknown>).endLine) : undefined,
          startOffset: typeof (body.patch as Record<string, unknown>).startOffset === 'number' ? Number((body.patch as Record<string, unknown>).startOffset) : undefined,
          endOffset: typeof (body.patch as Record<string, unknown>).endOffset === 'number' ? Number((body.patch as Record<string, unknown>).endOffset) : undefined,
          sectionHeading: typeof (body.patch as Record<string, unknown>).sectionHeading === 'string' ? String((body.patch as Record<string, unknown>).sectionHeading) : undefined,
          text: String((body.patch as Record<string, unknown>).text ?? ''),
        }
      : undefined,
    reason: String(body.reason ?? ''),
  };
}

function parseUpdateArtifactTableRequest(body: Record<string, unknown>): UpdateArtifactTableRequest {
  return {
    artifactId: String(body.artifactId ?? ''),
    tableLocator: (body.tableLocator ?? {}) as UpdateArtifactTableRequest['tableLocator'],
    operation: String(body.operation ?? '') as UpdateArtifactTableRequest['operation'],
    rowIndex: typeof body.rowIndex === 'number' ? body.rowIndex : undefined,
    columnIndex: typeof body.columnIndex === 'number' ? body.columnIndex : undefined,
    cellText: typeof body.cellText === 'string' ? body.cellText : undefined,
    headers: Array.isArray(body.headers) ? body.headers.map(String) : undefined,
    rows: Array.isArray(body.rows) ? body.rows.map((row) => Array.isArray(row) ? row.map(String) : []) : undefined,
    markdownTable: typeof body.markdownTable === 'string' ? body.markdownTable : undefined,
    reason: String(body.reason ?? ''),
  };
}

function requireChatId(request: Request) {
  const chatId = String(request.params.chatId ?? '').trim();
  if (!chatId) throw new HttpError(400, 'Missing chatId.');
  return chatId;
}

export async function handleListArtifacts(request: Request, response: Response) {
  sendJson(response, { artifacts: aiArtifactsRepository.listArtifacts(requireChatId(request), request.query.includePreview === 'true') });
}

export async function handleCreateArtifact(request: Request, response: Response) {
  const body = expectBody(request);
  sendJson(response, aiArtifactsRepository.createArtifact(requireChatId(request), {
    title: String(body.title ?? ''),
    type: String(body.type ?? 'markdown'),
    content: String(body.content ?? ''),
    contextPolicy: parseContextPolicy(body.contextPolicy),
    citations: Array.isArray(body.citations) ? body.citations.map(String) : [],
  }));
}

export async function handleGetArtifact(request: Request, response: Response) {
  const artifact = aiArtifactsRepository.getArtifact(requireChatId(request), String(request.params.artifactId ?? ''));
  if (!artifact) throw new HttpError(404, `Artifact "${request.params.artifactId}" was not found.`);
  sendJson(response, artifact);
}

export async function handlePatchArtifact(request: Request, response: Response) {
  sendJson(response, aiArtifactsRepository.updateArtifact(requireChatId(request), parseUpdateArtifactRequest(expectBody(request)), 'assistant'));
}

export async function handleDeleteArtifact(request: Request, response: Response) {
  aiArtifactsRepository.deleteArtifact(requireChatId(request), String(request.params.artifactId ?? ''));
  sendJson(response, { ok: true });
}

export async function handleFetchArtifactLines(request: Request, response: Response) {
  sendJson(response, aiArtifactsRepository.fetchArtifactLines(
    requireChatId(request),
    String(request.params.artifactId ?? ''),
    getOptionalIntParam(request.query.startLine, 1, 1, 100000),
    getOptionalIntParam(request.query.endLine, 50, 1, 100000),
  ));
}

export async function handleSearchArtifact(request: Request, response: Response) {
  const body = expectBody(request);
  sendJson(response, aiArtifactsRepository.searchArtifact(
    requireChatId(request),
    String(request.params.artifactId ?? ''),
    String(body.query ?? ''),
    (getOptionalQueryParam(body.mode) ?? 'keyword') as 'keyword' | 'heading' | 'hybrid',
    typeof body.limit === 'number' ? body.limit : 10,
  ));
}

export async function handleGetArtifactOutline(request: Request, response: Response) {
  sendJson(response, aiArtifactsRepository.getOutline(requireChatId(request), String(request.params.artifactId ?? '')));
}

export async function handleListArtifactVersions(request: Request, response: Response) {
  sendJson(response, { versions: aiArtifactsRepository.listVersions(requireChatId(request), String(request.params.artifactId ?? '')) });
}

export async function handleRestoreArtifactVersion(request: Request, response: Response) {
  sendJson(response, aiArtifactsRepository.restoreVersion(requireChatId(request), String(request.params.artifactId ?? ''), String(request.params.versionId ?? '')));
}

export async function handleExportArtifactToDoc(request: Request, response: Response) {
  const body = expectBody(request);
  sendJson(response, aiArtifactsRepository.exportArtifactToDoc(requireChatId(request), String(request.params.artifactId ?? ''), {
    mode: (getOptionalQueryParam(body.mode) ?? 'create_or_update_linked') as 'create_new' | 'update_linked' | 'create_or_update_linked',
    title: typeof body.title === 'string' ? body.title : undefined,
  }));
}

export async function handleUpdateArtifactTable(request: Request, response: Response) {
  sendJson(response, aiArtifactsRepository.updateArtifactTable(requireChatId(request), parseUpdateArtifactTableRequest(expectBody(request)), 'assistant'));
}
