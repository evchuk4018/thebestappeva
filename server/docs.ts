import type { Request, Response } from 'express';
import {
  parseCitationSource,
  parseDocPreferences,
  parseDocRecord,
  parseDocTabRecord,
  parseDocVersionDetail,
  type DocsMigrationImportRequest,
  type SaveDocRequest,
} from '../shared/docs-contract';
import { HttpError, getOptionalIntParam, getOptionalQueryParam } from './http';
import { docsRepository } from './db/docs-repository';

function sendJson(response: Response, payload: unknown) {
  response.status(200).json(payload);
}

function expectBody(request: Request) {
  if (!request.body) throw new HttpError(400, 'Missing request body.');
  return request.body as Record<string, unknown>;
}

function parseSaveDocRequest(value: unknown): SaveDocRequest {
  const record = value as Record<string, unknown>;
  const version = record.version && typeof record.version === 'object'
    ? {
        kind: String((record.version as Record<string, unknown>).kind) as SaveDocRequest['version']['kind'],
        label: typeof (record.version as Record<string, unknown>).label === 'string' ? String((record.version as Record<string, unknown>).label) : null,
      }
    : undefined;

  return {
    doc: parseDocRecord(record.doc, 'Document save request.doc'),
    tab: typeof record.tab === 'undefined' ? undefined : parseDocTabRecord(record.tab, 'Document save request.tab'),
    version,
  };
}

function parseMigrationImportRequest(value: unknown): DocsMigrationImportRequest {
  const record = value as Record<string, unknown>;
  return {
    sourceKey: String(record.sourceKey ?? ''),
    docs: Array.isArray(record.docs) ? record.docs.map((entry, index) => parseDocRecord(entry, `Migration import.docs[${index}]`)) : [],
    tabs: Array.isArray(record.tabs) ? record.tabs.map((entry, index) => parseDocTabRecord(entry, `Migration import.tabs[${index}]`)) : [],
    versions: Array.isArray(record.versions) ? record.versions.map((entry, index) => parseDocVersionDetail(entry, `Migration import.versions[${index}]`)) : [],
    citations: Array.isArray(record.citations)
      ? record.citations.map((entry, index) => {
          const parsed = parseCitationSource(entry, `Migration import.citations[${index}]`);
          const docId = String((entry as Record<string, unknown>).docId ?? '');
          return { ...parsed, docId };
        })
      : [],
    preferences: record.preferences === null || typeof record.preferences === 'undefined' ? null : parseDocPreferences(record.preferences, 'Migration import.preferences'),
  };
}

export async function handleListDocs(request: Request, response: Response) {
  sendJson(response, { docs: docsRepository.listDocs(getOptionalQueryParam(request.query.query), getOptionalQueryParam(request.query.sort) as never, request.query.showTrash === 'true') });
}

export async function handleCreateDoc(request: Request, response: Response) {
  const body = expectBody(request);
  const bundle = typeof body.html === 'string' && typeof body.title === 'string'
    ? docsRepository.createImportedDoc(body.title, body.html)
    : docsRepository.createDoc(typeof body.templateId === 'string' ? body.templateId : 'blank');
  sendJson(response, bundle);
}

export async function handleGetDoc(request: Request, response: Response) {
  const bundle = docsRepository.getDocBundle(request.params.docId, getOptionalQueryParam(request.query.cursor));
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, bundle);
}

export async function handlePutDoc(request: Request, response: Response) {
  const payload = parseSaveDocRequest(expectBody(request));
  if (payload.doc.id !== request.params.docId) throw new HttpError(400, 'Document ID mismatch.');
  sendJson(response, docsRepository.saveDoc(payload));
}

export async function handleDeleteDoc(request: Request, response: Response) {
  docsRepository.deleteDoc(request.params.docId);
  sendJson(response, { ok: true });
}

export async function handleDuplicateDoc(request: Request, response: Response) {
  const bundle = docsRepository.duplicateDoc(request.params.docId);
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, bundle);
}

export async function handleTrashDoc(request: Request, response: Response) {
  const bundle = docsRepository.setDocField(request.params.docId, (doc) => ({ ...doc, trashedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, bundle);
}

export async function handleRestoreDoc(request: Request, response: Response) {
  const bundle = docsRepository.setDocField(request.params.docId, (doc) => ({ ...doc, trashedAt: null, updatedAt: new Date().toISOString() }));
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, bundle);
}

export async function handleGetDocTabs(request: Request, response: Response) {
  const bundle = docsRepository.getDocBundle(request.params.docId);
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, { tabs: bundle.tabs });
}

export async function handlePostDocTab(request: Request, response: Response) {
  const tab = parseDocTabRecord(expectBody(request).tab, 'Document tab');
  if (tab.docId !== request.params.docId) throw new HttpError(400, 'Tab doc ID mismatch.');
  sendJson(response, docsRepository.saveTabs([tab]));
}

export async function handlePutDocTab(request: Request, response: Response) {
  const tab = parseDocTabRecord(expectBody(request).tab, 'Document tab');
  if (tab.id !== request.params.tabId) throw new HttpError(400, 'Tab ID mismatch.');
  sendJson(response, docsRepository.saveTabs([tab]));
}

export async function handleDeleteDocTab(request: Request, response: Response) {
  const bundle = docsRepository.deleteTab(request.params.docId, request.params.tabId);
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, bundle);
}

export async function handleListDocVersions(request: Request, response: Response) {
  sendJson(response, docsRepository.listVersions(request.params.docId, getOptionalQueryParam(request.query.cursor), getOptionalIntParam(request.query.limit, 25, 1, 100)));
}

export async function handleCreateDocVersion(request: Request, response: Response) {
  const payload = parseSaveDocRequest(expectBody(request));
  if (!payload.tab || !payload.version) throw new HttpError(400, 'Creating a version requires tab and version data.');
  sendJson(response, docsRepository.saveDoc(payload));
}

export async function handleGetDocVersion(request: Request, response: Response) {
  const version = docsRepository.getVersion(request.params.docId, request.params.versionId);
  if (!version) throw new HttpError(404, `Version "${request.params.versionId}" was not found.`);
  sendJson(response, { version });
}

export async function handleRestoreDocVersion(request: Request, response: Response) {
  const bundle = docsRepository.restoreVersion(request.params.docId, request.params.versionId);
  if (!bundle) throw new HttpError(404, `Version "${request.params.versionId}" was not found.`);
  sendJson(response, bundle);
}

export async function handleGetDocCitations(request: Request, response: Response) {
  const bundle = docsRepository.getDocBundle(request.params.docId);
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, { citations: bundle.citations });
}

export async function handleSaveDocCitations(request: Request, response: Response) {
  const body = expectBody(request);
  const citations = Array.isArray(body.citations) ? body.citations.map((entry, index) => parseCitationSource(entry, `Citations[${index}]`)) : [];
  sendJson(response, { citations: docsRepository.saveCitations(request.params.docId, citations) });
}

export async function handleDeleteDocCitation(request: Request, response: Response) {
  const bundle = docsRepository.getDocBundle(request.params.docId);
  if (!bundle) throw new HttpError(404, `Document "${request.params.docId}" was not found.`);
  sendJson(response, { citations: docsRepository.saveCitations(request.params.docId, bundle.citations.filter((citation) => citation.id !== request.params.citationId)) });
}

export async function handleGetDocPreferences(_request: Request, response: Response) {
  sendJson(response, { preferences: docsRepository.loadPreferences() });
}

export async function handlePutDocPreferences(request: Request, response: Response) {
  sendJson(response, { preferences: docsRepository.savePreferences(parseDocPreferences(expectBody(request).preferences, 'Docs preferences')) });
}

export async function handleGetDocsMigrationStatus(request: Request, response: Response) {
  const sourceKey = getOptionalQueryParam(request.query.sourceKey);
  sendJson(response, { migrated: sourceKey ? docsRepository.hasMigration(sourceKey) : false });
}

export async function handleImportDocsMigration(request: Request, response: Response) {
  const payload = parseMigrationImportRequest(expectBody(request));
  if (!payload.sourceKey.trim()) throw new HttpError(400, 'Missing migration source key.');
  sendJson(response, { ok: true, counts: docsRepository.importMigration(payload) });
}
