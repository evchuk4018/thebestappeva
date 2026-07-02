import {
  ArtifactCardSummary,
  ArtifactContextPolicy,
  ArtifactLineResponse,
  ArtifactOutlineResponse,
  ArtifactRecord,
  ArtifactSearchResponse,
  ArtifactSummary,
  ArtifactVersionRecord,
  ExportArtifactToDocResponse,
  UpdateArtifactRequest,
  UpdateArtifactTableRequest,
  parseArtifactCardSummary,
  parseArtifactLineResponse,
  parseArtifactOutlineResponse,
  parseArtifactRecord,
  parseArtifactSearchResponse,
  parseArtifactSummary,
  parseArtifactVersionRecord,
  parseExportArtifactToDocResponse,
} from '../../shared/ai-artifacts-contract';
import { requestJson } from './api';

export async function listArtifacts(chatId: string, includePreview = false) {
  const payload = await requestJson<{ artifacts?: unknown[] }>(`/ai/chats/${chatId}/artifacts`, { query: { includePreview } });
  return Array.isArray(payload.artifacts) ? payload.artifacts.map((entry, index) => parseArtifactSummary(entry, `artifacts[${index}]`)) : [];
}

export async function createArtifact(chatId: string, body: { title: string; type: string; content: string; contextPolicy?: ArtifactContextPolicy; citations?: string[] }) {
  return parseArtifactRecord(await requestJson(`/ai/chats/${chatId}/artifacts`, { method: 'POST', json: body }));
}

export async function loadArtifact(chatId: string, artifactId: string) {
  return parseArtifactRecord(await requestJson(`/ai/chats/${chatId}/artifacts/${artifactId}`));
}

export async function updateArtifact(chatId: string, request: UpdateArtifactRequest) {
  const payload = await requestJson<Record<string, unknown>>(`/ai/chats/${chatId}/artifacts/${request.artifactId}`, { method: 'PATCH', json: request });
  return {
    artifact: parseArtifactRecord(payload.artifact, 'artifact'),
    changedRange: payload.changedRange ? payload.changedRange as { startLine: number; endLine: number } : undefined,
    historyVersionId: typeof payload.historyVersionId === 'string' ? payload.historyVersionId : undefined,
  };
}

export async function updateArtifactTable(chatId: string, request: UpdateArtifactTableRequest) {
  const payload = await requestJson<Record<string, unknown>>(`/ai/chats/${chatId}/artifacts/${request.artifactId}/table`, { method: 'POST', json: request });
  return {
    artifact: parseArtifactRecord(payload.artifact, 'artifact'),
    tableRange: payload.tableRange as { startLine: number; endLine: number },
    historyVersionId: typeof payload.historyVersionId === 'string' ? payload.historyVersionId : undefined,
  };
}

export async function fetchArtifactLines(chatId: string, artifactId: string, startLine: number, endLine: number): Promise<ArtifactLineResponse> {
  return parseArtifactLineResponse(await requestJson(`/ai/chats/${chatId}/artifacts/${artifactId}/lines`, { query: { startLine, endLine } }));
}

export async function searchArtifact(chatId: string, artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid' = 'keyword', limit = 10): Promise<ArtifactSearchResponse> {
  return parseArtifactSearchResponse(await requestJson(`/ai/chats/${chatId}/artifacts/${artifactId}/search`, { method: 'POST', json: { query, mode, limit } }));
}

export async function getArtifactOutline(chatId: string, artifactId: string): Promise<ArtifactOutlineResponse> {
  return parseArtifactOutlineResponse(await requestJson(`/ai/chats/${chatId}/artifacts/${artifactId}/outline`));
}

export async function listArtifactVersions(chatId: string, artifactId: string) {
  const payload = await requestJson<{ versions?: unknown[] }>(`/ai/chats/${chatId}/artifacts/${artifactId}/versions`);
  return Array.isArray(payload.versions) ? payload.versions.map((entry, index) => parseArtifactVersionRecord(entry, `versions[${index}]`)) : [];
}

export async function restoreArtifactVersion(chatId: string, artifactId: string, versionId: string) {
  return parseArtifactRecord(await requestJson(`/ai/chats/${chatId}/artifacts/${artifactId}/versions/${versionId}/restore`, { method: 'POST' }));
}

export async function exportArtifactToDoc(chatId: string, artifactId: string, mode: 'create_new' | 'update_linked' | 'create_or_update_linked' = 'create_or_update_linked', title?: string): Promise<ExportArtifactToDocResponse> {
  return parseExportArtifactToDocResponse(await requestJson(`/ai/chats/${chatId}/artifacts/${artifactId}/export-to-doc`, { method: 'POST', json: { mode, title } }));
}

export function normalizeArtifactCards(value: unknown) {
  return Array.isArray(value) ? value.map((entry, index) => parseArtifactCardSummary(entry, `artifactCards[${index}]`)) : [];
}

export function findArtifactSummary(summaries: ArtifactSummary[], artifactId: string) {
  return summaries.find((artifact) => artifact.artifactId === artifactId) ?? null;
}

export type { ArtifactCardSummary, ArtifactRecord, ArtifactSearchResponse, ArtifactSummary, ArtifactVersionRecord };
