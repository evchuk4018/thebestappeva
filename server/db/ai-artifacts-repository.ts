import type BetterSqlite3 from 'better-sqlite3';
import {
  ArtifactRecord,
  ArtifactSummary,
  ArtifactVersionRecord,
  UpdateArtifactRequest,
  UpdateArtifactTableRequest,
} from '../../shared/ai-artifacts-contract';
import { createDocId } from '../../shared/docs-helpers';
import { applyTableOperation } from '../ai-artifact-tables';
import {
  applyPatch,
  buildOutline,
  countMarkdownLines,
  fetchLines,
  markdownToHtml,
  normalizeMarkdown,
  searchMarkdown,
  summarizeMarkdown,
} from '../ai-artifacts-markdown';
import type { DocTabRecord } from '../../shared/docs-contract';
import { getCanonicalOwnerId } from '../ownership';
import { createDocsRepository } from './docs-repository';
import { getDatabase } from './database';

type Row = Record<string, string | number | null>;
type UpdateActor = 'assistant' | 'user' | 'system';

function mapSummary(row: Row, content: string, includePreview = false): ArtifactSummary {
  return {
    artifactId: String(row.id),
    title: String(row.title),
    type: String(row.type),
    updatedAt: String(row.updated_at),
    lineCount: countMarkdownLines(content),
    charCount: content.length,
    preview: includePreview ? summarizeMarkdown(content) : undefined,
    linkedDocId: row.linked_doc_id ? String(row.linked_doc_id) : null,
  };
}

function mapRecord(row: Row): ArtifactRecord {
  const content = String(row.content_markdown);
  return {
    ...mapSummary(row, content, true),
    sessionId: String(row.chat_id),
    schemaVersion: Number(row.schema_version),
    content,
    contextPolicy: JSON.parse(String(row.context_policy_json)),
    citations: JSON.parse(String(row.citations_json)),
    createdAt: String(row.created_at),
    lastExportedAt: row.last_exported_at ? String(row.last_exported_at) : null,
  };
}

function mapVersion(row: Row): ArtifactVersionRecord {
  return {
    versionId: String(row.id),
    artifactId: String(row.artifact_id),
    createdAt: String(row.created_at),
    reason: String(row.reason),
    actor: String(row.actor) as ArtifactVersionRecord['actor'],
  };
}

function createVersionId() {
  return createDocId('artifact-version');
}

function createArtifactId() {
  return createDocId('artifact');
}

export function createAiArtifactsRepository(
  database: BetterSqlite3.Database = getDatabase(),
  options: { docsRepo?: ReturnType<typeof createDocsRepository>; ownerId?: string } = {},
) {
  const ownerId = options.ownerId ?? getCanonicalOwnerId();
  const docsRepo = options.docsRepo ?? createDocsRepository(database, ownerId);
  const selectArtifact = database.prepare('SELECT * FROM ai_artifacts WHERE owner_id = ? AND id = ? AND chat_id = ?');
  const listArtifactsStatement = database.prepare('SELECT * FROM ai_artifacts WHERE owner_id = ? AND chat_id = ? ORDER BY updated_at DESC, id DESC');
  const selectVersions = database.prepare('SELECT * FROM ai_artifact_versions WHERE owner_id = ? AND artifact_id = ? ORDER BY created_at DESC, id DESC');
  const insertArtifact = database.prepare(`
    INSERT INTO ai_artifacts (id, owner_id, chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, created_at, updated_at)
    VALUES (@id, @owner_id, @chat_id, @title, @type, @schema_version, @content_markdown, @context_policy_json, @citations_json, @linked_doc_id, @last_exported_at, @created_at, @updated_at)
  `);
  const updateArtifactStatement = database.prepare(`
    UPDATE ai_artifacts
    SET title = @title,
        type = @type,
        content_markdown = @content_markdown,
        context_policy_json = @context_policy_json,
        citations_json = @citations_json,
        linked_doc_id = @linked_doc_id,
        last_exported_at = @last_exported_at,
        updated_at = @updated_at
    WHERE owner_id = @owner_id AND id = @id AND chat_id = @chat_id
  `);
  const insertVersion = database.prepare(`
    INSERT INTO ai_artifact_versions (id, owner_id, artifact_id, title, type, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, actor, reason, created_at)
    VALUES (@id, @owner_id, @artifact_id, @title, @type, @content_markdown, @context_policy_json, @citations_json, @linked_doc_id, @last_exported_at, @actor, @reason, @created_at)
  `);

  function getArtifact(chatId: string, artifactId: string) {
    const row = selectArtifact.get(ownerId, artifactId, chatId) as Row | undefined;
    return row ? mapRecord(row) : null;
  }

  function snapshotArtifact(artifact: ArtifactRecord, actor: UpdateActor, reason: string) {
    const versionId = createVersionId();
    insertVersion.run({
      id: versionId,
      owner_id: ownerId,
      artifact_id: artifact.artifactId,
      title: artifact.title,
      type: artifact.type,
      content_markdown: artifact.content,
      context_policy_json: JSON.stringify(artifact.contextPolicy),
      citations_json: JSON.stringify(artifact.citations),
      linked_doc_id: artifact.linkedDocId ?? null,
      last_exported_at: artifact.lastExportedAt ?? null,
      actor,
      reason,
      created_at: new Date().toISOString(),
    });
    return versionId;
  }

  function persistArtifact(artifact: ArtifactRecord) {
    updateArtifactStatement.run({
      id: artifact.artifactId,
      owner_id: ownerId,
      chat_id: artifact.sessionId,
      title: artifact.title,
      type: artifact.type,
      content_markdown: artifact.content,
      context_policy_json: JSON.stringify(artifact.contextPolicy),
      citations_json: JSON.stringify(artifact.citations),
      linked_doc_id: artifact.linkedDocId ?? null,
      last_exported_at: artifact.lastExportedAt ?? null,
      updated_at: artifact.updatedAt,
    });
  }

  return {
    createArtifact(chatId: string, args: { title: string; type: string; content: string; contextPolicy: ArtifactRecord['contextPolicy']; citations?: string[] }) {
      const now = new Date().toISOString();
      const artifact: ArtifactRecord = {
        artifactId: createArtifactId(),
        sessionId: chatId,
        schemaVersion: 1,
        title: args.title.trim() || 'Untitled artifact',
        type: args.type.trim() || 'markdown',
        content: normalizeMarkdown(args.content),
        contextPolicy: args.contextPolicy,
        citations: args.citations ?? [],
        createdAt: now,
        updatedAt: now,
        lineCount: 0,
        charCount: 0,
        preview: '',
        linkedDocId: null,
        lastExportedAt: null,
      };
      insertArtifact.run({
        id: artifact.artifactId,
        owner_id: ownerId,
        chat_id: artifact.sessionId,
        title: artifact.title,
        type: artifact.type,
        schema_version: artifact.schemaVersion,
        content_markdown: artifact.content,
        context_policy_json: JSON.stringify(artifact.contextPolicy),
        citations_json: JSON.stringify(artifact.citations),
        linked_doc_id: null,
        last_exported_at: null,
        created_at: now,
        updated_at: now,
      });
      return getArtifact(chatId, artifact.artifactId)!;
    },
    listArtifacts(chatId: string, includePreview = false) {
      return (listArtifactsStatement.all(ownerId, chatId) as Row[]).map((row) => mapSummary(row, String(row.content_markdown), includePreview));
    },
    getArtifact,
    listVersions(chatId: string, artifactId: string) {
      return getArtifact(chatId, artifactId) ? (selectVersions.all(ownerId, artifactId) as Row[]).map(mapVersion) : [];
    },
    updateArtifact(chatId: string, request: UpdateArtifactRequest, actor: UpdateActor = 'assistant') {
      return database.transaction(() => {
        const current = getArtifact(chatId, request.artifactId);
        if (!current) throw new Error(`Artifact "${request.artifactId}" was not found.`);
        const historyVersionId = snapshotArtifact(current, actor, request.reason);
        const patchResult = request.content
          ? { content: normalizeMarkdown(request.content), changedRange: { startLine: 1, endLine: countMarkdownLines(request.content) } }
          : request.patch
            ? applyPatch(current.content, request.patch)
            : { content: current.content, changedRange: undefined };
        const nextArtifact: ArtifactRecord = {
          ...current,
          title: request.title?.trim() || current.title,
          type: request.type?.trim() || current.type,
          content: patchResult.content,
          contextPolicy: request.contextPolicy ? { ...current.contextPolicy, ...request.contextPolicy } : current.contextPolicy,
          updatedAt: new Date().toISOString(),
        };
        persistArtifact(nextArtifact);
        return { artifact: getArtifact(chatId, request.artifactId)!, changedRange: patchResult.changedRange, historyVersionId };
      })();
    },
    updateArtifactTable(chatId: string, request: UpdateArtifactTableRequest, actor: UpdateActor = 'assistant') {
      return database.transaction(() => {
        const current = getArtifact(chatId, request.artifactId);
        if (!current) throw new Error(`Artifact "${request.artifactId}" was not found.`);
        const historyVersionId = snapshotArtifact(current, actor, request.reason);
        const next = applyTableOperation(current.content, request);
        persistArtifact({ ...current, content: next.content, updatedAt: new Date().toISOString() });
        return { artifact: getArtifact(chatId, request.artifactId)!, tableRange: next.tableRange, historyVersionId };
      })();
    },
    fetchArtifactLines(chatId: string, artifactId: string, startLine: number, endLine: number) {
      const artifact = getArtifact(chatId, artifactId);
      if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
      return { artifact, ...fetchLines(artifact.content, startLine, endLine) };
    },
    searchArtifact(chatId: string, artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid', limit = 10) {
      const artifact = getArtifact(chatId, artifactId);
      if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
      const matches = searchMarkdown(artifact.content, query, mode, limit);
      return { artifactId: artifact.artifactId, title: artifact.title, totalMatches: matches.length, matches };
    },
    getOutline(chatId: string, artifactId: string) {
      const artifact = getArtifact(chatId, artifactId);
      if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
      return { artifactId: artifact.artifactId, title: artifact.title, outline: buildOutline(artifact.content) };
    },
    restoreVersion(chatId: string, artifactId: string, versionId: string) {
      return database.transaction(() => {
        const current = getArtifact(chatId, artifactId);
        const version = (database.prepare('SELECT * FROM ai_artifact_versions WHERE owner_id = ? AND artifact_id = ? AND id = ?').get(ownerId, artifactId, versionId) as Row | undefined);
        if (!current || !version) throw new Error(`Artifact version "${versionId}" was not found.`);
        snapshotArtifact(current, 'system', `Restore from ${versionId}`);
        const nextArtifact: ArtifactRecord = {
          ...current,
          title: String(version.title),
          type: String(version.type),
          content: String(version.content_markdown),
          contextPolicy: JSON.parse(String(version.context_policy_json)),
          citations: JSON.parse(String(version.citations_json)),
          linkedDocId: version.linked_doc_id ? String(version.linked_doc_id) : null,
          lastExportedAt: version.last_exported_at ? String(version.last_exported_at) : null,
          updatedAt: new Date().toISOString(),
        };
        persistArtifact(nextArtifact);
        return getArtifact(chatId, artifactId)!;
      })();
    },
    exportArtifactToDoc(chatId: string, artifactId: string, args: { mode: 'create_new' | 'update_linked' | 'create_or_update_linked'; title?: string }) {
      return database.transaction(() => {
        const artifact = getArtifact(chatId, artifactId);
        if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
        const title = args.title?.trim() || artifact.title;
        const html = markdownToHtml(artifact.content, artifact.contextPolicy);
        const existing = artifact.linkedDocId ? docsRepo.getDocBundle(artifact.linkedDocId) : null;
        let docId = existing?.doc.id ?? '';
        let action: 'created' | 'updated' = 'updated';

        if (args.mode === 'create_new' || (!existing && args.mode === 'create_or_update_linked')) {
          const created = docsRepo.createImportedDoc(title, html);
          docId = created.doc.id;
          action = 'created';
        } else {
          if (!existing) throw new Error('This artifact does not have a linked document to update.');
          const tab = existing.tabs[0] as DocTabRecord;
          docsRepo.saveDoc({
            doc: { ...existing.doc, title, updatedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() },
            tab: { ...tab, content: html, contentFormat: 'html', textContent: artifact.content, updatedAt: new Date().toISOString() },
            version: { kind: 'named', label: `Artifact export - ${title}` },
          });
        }

        persistArtifact({ ...artifact, linkedDocId: docId, lastExportedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return { artifactId, docId, title, action, openUrl: `/docs/${docId}`, linkedDocId: docId };
      })();
    },
    deleteArtifact(chatId: string, artifactId: string) {
      database.prepare('DELETE FROM ai_artifacts WHERE owner_id = ? AND id = ? AND chat_id = ?').run(ownerId, artifactId, chatId);
    },
  };
}

let aiArtifactsRepositorySingleton: ReturnType<typeof createAiArtifactsRepository> | null = null;

function getAiArtifactsRepositorySingleton() {
  aiArtifactsRepositorySingleton ??= createAiArtifactsRepository();
  return aiArtifactsRepositorySingleton;
}

export const aiArtifactsRepository = new Proxy({} as ReturnType<typeof createAiArtifactsRepository>, {
  get(_target, property, receiver) {
    return Reflect.get(getAiArtifactsRepositorySingleton(), property, receiver);
  },
});
