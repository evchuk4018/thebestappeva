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

interface FetchOptions extends RequestInit {
  keepalive?: boolean;
}

async function readJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({ error: 'The local server returned invalid JSON.' }));
  if (!response.ok) {
    const message = payload && typeof payload.error === 'string' ? payload.error : `The local server failed with ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && typeof value !== 'undefined' && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
}

async function requestJson(path: string, init?: FetchOptions) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  return readJsonResponse(response);
}

export async function fetchDocs() {
  const payload = await requestJson('/api/docs');
  return Array.isArray(payload.docs) ? payload.docs.map((entry, index) => parseDocSearchIndexEntry(entry, `Docs[${index}]`)) : [];
}

export async function createDoc(request: CreateDocRequest = {}) {
  return parseDocBundle(await requestJson('/api/docs', { method: 'POST', body: JSON.stringify(request) }));
}

export async function createImportedDoc(request: CreateImportedDocRequest) {
  return parseDocBundle(await requestJson('/api/docs', { method: 'POST', body: JSON.stringify(request) }));
}

export async function fetchDocBundle(docId: string, cursor?: string | null) {
  const response = await fetch(withQuery(`/api/docs/${docId}`, { cursor }));
  if (response.status === 404) return null;
  return parseDocBundle(await readJsonResponse(response));
}

export async function saveDoc(request: SaveDocRequest, options: FetchOptions = {}) {
  return parseDocBundle(await requestJson(`/api/docs/${request.doc.id}`, { method: 'PUT', body: JSON.stringify(request), keepalive: options.keepalive }));
}

export async function saveTabs(docId: string, tabs: unknown[]) {
  const bundles = await Promise.all(tabs.map((tab) => requestJson(`/api/docs/${docId}/tabs`, { method: 'POST', body: JSON.stringify({ tab }) })));
  const last = bundles.at(-1);
  return last ? parseDocBundle(last) : null;
}

export async function loadMoreDocVersions(docId: string, cursor: string, limit = 25): Promise<ListDocVersionsResponse> {
  return parseListDocVersionsResponse(await requestJson(withQuery(`/api/docs/${docId}/versions`, { cursor, limit })));
}

export async function restoreDocVersion(docId: string, versionId: string) {
  return parseDocBundle(await requestJson(`/api/docs/${docId}/versions/${versionId}/restore`, { method: 'POST' }));
}

export async function getDocVersion(docId: string, versionId: string) {
  const payload = await requestJson(`/api/docs/${docId}/versions/${versionId}`);
  return parseDocVersionDetail(payload.version, 'Document version response.version');
}

export async function duplicateDoc(docId: string) {
  const response = await fetch(`/api/docs/${docId}/duplicate`, { method: 'POST' });
  if (response.status === 404) return null;
  return parseDocBundle(await readJsonResponse(response));
}

async function mutateDoc(docId: string, path: string, method: 'POST' | 'DELETE') {
  const response = await fetch(path, { method });
  if (response.status === 404) return null;
  return parseDocBundle(await readJsonResponse(response));
}

export function trashDoc(docId: string) {
  return mutateDoc(docId, `/api/docs/${docId}/trash`, 'POST');
}

export function restoreDoc(docId: string) {
  return mutateDoc(docId, `/api/docs/${docId}/trash`, 'DELETE');
}

export async function deleteDoc(docId: string) {
  await requestJson(`/api/docs/${docId}`, { method: 'DELETE' });
}

export async function loadDocPreferences() {
  const payload = await requestJson('/api/docs/preferences');
  return parseDocPreferences(payload.preferences, 'Docs preferences response.preferences');
}

export async function saveDocPreferences(preferences: DocPreferences) {
  const payload = await requestJson('/api/docs/preferences', { method: 'PUT', body: JSON.stringify({ preferences }) });
  return parseDocPreferences(payload.preferences, 'Docs preferences response.preferences');
}

export async function saveDocCitations(docId: string, citations: CitationSource[]) {
  const payload = await requestJson(`/api/docs/${docId}/citations`, { method: 'PUT', body: JSON.stringify({ citations }) });
  return Array.isArray(payload.citations) ? payload.citations.map((entry, index) => parseCitationSource(entry, `Citations[${index}]`)) : [];
}

export async function fetchDocsMigrationStatus(sourceKey?: string) {
  return parseDocsMigrationStatusResponse(await requestJson(withQuery('/api/docs/migration/status', { sourceKey })));
}

export async function importDocsMigration(payload: DocsMigrationImportRequest) {
  return requestJson('/api/docs/migration/import', { method: 'POST', body: JSON.stringify(payload) });
}
