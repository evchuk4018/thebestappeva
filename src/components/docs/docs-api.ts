import {
  parseCitationSource,
  parseDocBundle,
  parseDocPreferences,
  parseDocSearchIndexEntry,
  parseDocVersionDetail,
  parseDocsMigrationStatusResponse,
  parseListDocVersionsResponse,
  type CitationSource,
  type CreateDocRequest,
  type CreateImportedDocRequest,
  type DocBundle,
  type DocPreferences,
  type DocsMigrationImportRequest,
  type ListDocVersionsResponse,
  type SaveDocRequest,
} from '../../../shared/docs-contract';
import { readJsonResponse, requestApi, requestJson } from '../../lib/api';

interface FetchOptions extends RequestInit {
  keepalive?: boolean;
}

export async function fetchDocs() {
  const payload = await requestJson<{ docs?: unknown[] }>('/docs');
  return Array.isArray(payload.docs) ? payload.docs.map((entry, index) => parseDocSearchIndexEntry(entry, `Docs[${index}]`)) : [];
}

export async function createDoc(request: CreateDocRequest = {}) {
  return parseDocBundle(await requestJson('/docs', { method: 'POST', json: request }));
}

export async function createImportedDoc(request: CreateImportedDocRequest) {
  return parseDocBundle(await requestJson('/docs', { method: 'POST', json: request }));
}

export async function fetchDocBundle(docId: string, cursor?: string | null) {
  const response = await requestApi(`/docs/${docId}`, { query: { cursor } });
  if (response.status === 404) return null;
  return parseDocBundle(await readJsonResponse(response));
}

export async function saveDoc(request: SaveDocRequest, options: FetchOptions = {}) {
  return parseDocBundle(await requestJson(`/docs/${request.doc.id}`, { method: 'PUT', json: request, keepalive: options.keepalive }));
}

export async function saveTabs(docId: string, tabs: unknown[]) {
  const bundles = await Promise.all(tabs.map((tab) => requestJson(`/docs/${docId}/tabs`, { method: 'POST', json: { tab } })));
  const last = bundles.at(-1);
  return last ? parseDocBundle(last) : null;
}

export async function loadMoreDocVersions(docId: string, cursor: string, limit = 25): Promise<ListDocVersionsResponse> {
  return parseListDocVersionsResponse(await requestJson(`/docs/${docId}/versions`, { query: { cursor, limit } }));
}

export async function restoreDocVersion(docId: string, versionId: string) {
  return parseDocBundle(await requestJson(`/docs/${docId}/versions/${versionId}/restore`, { method: 'POST' }));
}

export async function getDocVersion(docId: string, versionId: string) {
  const payload = await requestJson<{ version: unknown }>(`/docs/${docId}/versions/${versionId}`);
  return parseDocVersionDetail(payload.version, 'Document version response.version');
}

export async function duplicateDoc(docId: string) {
  const response = await requestApi(`/docs/${docId}/duplicate`, { method: 'POST' });
  if (response.status === 404) return null;
  return parseDocBundle(await readJsonResponse(response));
}

async function mutateDoc(docId: string, path: string, method: 'POST' | 'DELETE') {
  const response = await requestApi(path, { method });
  if (response.status === 404) return null;
  return parseDocBundle(await readJsonResponse(response));
}

export function trashDoc(docId: string) {
  return mutateDoc(docId, `/docs/${docId}/trash`, 'POST');
}

export function restoreDoc(docId: string) {
  return mutateDoc(docId, `/docs/${docId}/trash`, 'DELETE');
}

export async function deleteDoc(docId: string) {
  await requestJson(`/docs/${docId}`, { method: 'DELETE' });
}

export async function loadDocPreferences() {
  const payload = await requestJson<{ preferences: unknown }>('/docs/preferences');
  return parseDocPreferences(payload.preferences, 'Docs preferences response.preferences');
}

export async function saveDocPreferences(preferences: DocPreferences) {
  const payload = await requestJson<{ preferences: unknown }>('/docs/preferences', { method: 'PUT', json: { preferences } });
  return parseDocPreferences(payload.preferences, 'Docs preferences response.preferences');
}

export async function saveDocCitations(docId: string, citations: CitationSource[]) {
  const payload = await requestJson<{ citations?: unknown[] }>(`/docs/${docId}/citations`, { method: 'PUT', json: { citations } });
  return Array.isArray(payload.citations) ? payload.citations.map((entry, index) => parseCitationSource(entry, `Citations[${index}]`)) : [];
}

export async function fetchDocsMigrationStatus(sourceKey?: string) {
  return parseDocsMigrationStatusResponse(await requestJson('/docs/migration/status', { query: { sourceKey } }));
}

export async function importDocsMigration(payload: DocsMigrationImportRequest) {
  return requestJson('/docs/migration/import', { method: 'POST', json: payload });
}
