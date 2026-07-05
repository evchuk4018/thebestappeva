import type { Pool, PoolClient } from 'pg';
import {
  ArtifactRecord,
  ArtifactSummary,
  ArtifactVersionRecord,
  UpdateArtifactRequest,
  UpdateArtifactTableRequest,
} from '../../shared/ai-artifacts-contract';
import { createDocId } from '../../shared/docs-helpers';
import type { DocTabRecord } from '../../shared/docs-contract';
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
import { getPostgresPool } from './postgres';
import { createPostgresDocsRepository } from './postgres-docs-repository';
import { assertOwnerUuid, normalizeJsonb, runPostgresTransaction, toIsoString, toJsonbParam, type PostgresExecutor } from './postgres-repository-utils';

type Row = Record<string, unknown>;
type UpdateActor = 'assistant' | 'user' | 'system';
type DocsRepo = ReturnType<typeof createPostgresDocsRepository>;

function mapSummary(row: Row, content: string, includePreview = false): ArtifactSummary {
  return {
    artifactId: String(row.id),
    title: String(row.title),
    type: String(row.type),
    updatedAt: toIsoString(row.updated_at),
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
    contextPolicy: normalizeJsonb(row.context_policy_json) as ArtifactRecord['contextPolicy'],
    citations: normalizeJsonb(row.citations_json) as string[],
    createdAt: toIsoString(row.created_at),
    lastExportedAt: row.last_exported_at ? toIsoString(row.last_exported_at) : null,
  };
}

function mapVersion(row: Row): ArtifactVersionRecord {
  return {
    versionId: String(row.id),
    artifactId: String(row.artifact_id),
    createdAt: toIsoString(row.created_at),
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

export function createPostgresAiArtifactsRepository(
  ownerId: string,
  executor: PostgresExecutor | Pool | PoolClient = getPostgresPool(),
  options: { docsRepo?: DocsRepo } = {},
) {
  const validatedOwnerId = assertOwnerUuid(ownerId);
  const docsRepo = options.docsRepo ?? createPostgresDocsRepository(validatedOwnerId, executor);

  async function getArtifactWithExecutor(nextExecutor: PostgresExecutor, chatId: string, artifactId: string) {
    const result = await nextExecutor.query('SELECT * FROM ai_artifacts WHERE owner_id = $1 AND id = $2 AND chat_id = $3', [validatedOwnerId, artifactId, chatId]);
    const row = result.rows[0] as Row | undefined;
    return row ? mapRecord(row) : null;
  }

  async function snapshotArtifact(nextExecutor: PostgresExecutor, artifact: ArtifactRecord, actor: UpdateActor, reason: string) {
    const versionId = createVersionId();
    await nextExecutor.query(`
      INSERT INTO ai_artifact_versions (owner_id, id, artifact_id, title, type, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, actor, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13)
    `, [validatedOwnerId, versionId, artifact.artifactId, artifact.title, artifact.type, artifact.content, toJsonbParam(artifact.contextPolicy), toJsonbParam(artifact.citations), artifact.linkedDocId ?? null, artifact.lastExportedAt ?? null, actor, reason, new Date().toISOString()]);
    return versionId;
  }

  async function persistArtifact(nextExecutor: PostgresExecutor, artifact: ArtifactRecord) {
    await nextExecutor.query(`
      UPDATE ai_artifacts
      SET title = $4,
          type = $5,
          content_markdown = $6,
          context_policy_json = $7::jsonb,
          citations_json = $8::jsonb,
          linked_doc_id = $9,
          last_exported_at = $10,
          updated_at = $11
      WHERE owner_id = $1 AND id = $2 AND chat_id = $3
    `, [validatedOwnerId, artifact.artifactId, artifact.sessionId, artifact.title, artifact.type, artifact.content, toJsonbParam(artifact.contextPolicy), toJsonbParam(artifact.citations), artifact.linkedDocId ?? null, artifact.lastExportedAt ?? null, artifact.updatedAt]);
  }

  return {
    async createArtifact(chatId: string, args: { title: string; type: string; content: string; contextPolicy: ArtifactRecord['contextPolicy']; citations?: string[] }) {
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
      await (executor as PostgresExecutor).query(`
        INSERT INTO ai_artifacts (owner_id, id, chat_id, title, type, schema_version, content_markdown, context_policy_json, citations_json, linked_doc_id, last_exported_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13)
      `, [validatedOwnerId, artifact.artifactId, artifact.sessionId, artifact.title, artifact.type, artifact.schemaVersion, artifact.content, toJsonbParam(artifact.contextPolicy), toJsonbParam(artifact.citations), null, null, now, now]);
      return (await getArtifactWithExecutor(executor as PostgresExecutor, chatId, artifact.artifactId))!;
    },
    async listArtifacts(chatId: string, includePreview = false) {
      const result = await (executor as PostgresExecutor).query('SELECT * FROM ai_artifacts WHERE owner_id = $1 AND chat_id = $2 ORDER BY updated_at DESC, id DESC', [validatedOwnerId, chatId]);
      return result.rows.map((row) => mapSummary(row as Row, String((row as Row).content_markdown), includePreview));
    },
    async getArtifact(chatId: string, artifactId: string) {
      return getArtifactWithExecutor(executor as PostgresExecutor, chatId, artifactId);
    },
    async listVersions(chatId: string, artifactId: string) {
      if (!await getArtifactWithExecutor(executor as PostgresExecutor, chatId, artifactId)) return [];
      const result = await (executor as PostgresExecutor).query('SELECT * FROM ai_artifact_versions WHERE owner_id = $1 AND artifact_id = $2 ORDER BY created_at DESC, id DESC', [validatedOwnerId, artifactId]);
      return result.rows.map((row) => mapVersion(row as Row));
    },
    async updateArtifact(chatId: string, request: UpdateArtifactRequest, actor: UpdateActor = 'assistant') {
      return runPostgresTransaction(executor, async (client) => {
        const current = await getArtifactWithExecutor(client, chatId, request.artifactId);
        if (!current) throw new Error(`Artifact "${request.artifactId}" was not found.`);
        const historyVersionId = await snapshotArtifact(client, current, actor, request.reason);
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
        await persistArtifact(client, nextArtifact);
        return { artifact: (await getArtifactWithExecutor(client, chatId, request.artifactId))!, changedRange: patchResult.changedRange, historyVersionId };
      });
    },
    async updateArtifactTable(chatId: string, request: UpdateArtifactTableRequest, actor: UpdateActor = 'assistant') {
      return runPostgresTransaction(executor, async (client) => {
        const current = await getArtifactWithExecutor(client, chatId, request.artifactId);
        if (!current) throw new Error(`Artifact "${request.artifactId}" was not found.`);
        const historyVersionId = await snapshotArtifact(client, current, actor, request.reason);
        const next = applyTableOperation(current.content, request);
        await persistArtifact(client, { ...current, content: next.content, updatedAt: new Date().toISOString() });
        return { artifact: (await getArtifactWithExecutor(client, chatId, request.artifactId))!, tableRange: next.tableRange, historyVersionId };
      });
    },
    async fetchArtifactLines(chatId: string, artifactId: string, startLine: number, endLine: number) {
      const artifact = await getArtifactWithExecutor(executor as PostgresExecutor, chatId, artifactId);
      if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
      return { artifact, ...fetchLines(artifact.content, startLine, endLine) };
    },
    async searchArtifact(chatId: string, artifactId: string, query: string, mode: 'keyword' | 'heading' | 'hybrid', limit = 10) {
      const artifact = await getArtifactWithExecutor(executor as PostgresExecutor, chatId, artifactId);
      if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
      const matches = searchMarkdown(artifact.content, query, mode, limit);
      return { artifactId: artifact.artifactId, title: artifact.title, totalMatches: matches.length, matches };
    },
    async getOutline(chatId: string, artifactId: string) {
      const artifact = await getArtifactWithExecutor(executor as PostgresExecutor, chatId, artifactId);
      if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
      return { artifactId: artifact.artifactId, title: artifact.title, outline: buildOutline(artifact.content) };
    },
    async restoreVersion(chatId: string, artifactId: string, versionId: string) {
      return runPostgresTransaction(executor, async (client) => {
        const current = await getArtifactWithExecutor(client, chatId, artifactId);
        const versionResult = await client.query('SELECT * FROM ai_artifact_versions WHERE owner_id = $1 AND artifact_id = $2 AND id = $3', [validatedOwnerId, artifactId, versionId]);
        const version = versionResult.rows[0] as Row | undefined;
        if (!current || !version) throw new Error(`Artifact version "${versionId}" was not found.`);
        await snapshotArtifact(client, current, 'system', `Restore from ${versionId}`);
        const nextArtifact: ArtifactRecord = {
          ...current,
          title: String(version.title),
          type: String(version.type),
          content: String(version.content_markdown),
          contextPolicy: normalizeJsonb(version.context_policy_json) as ArtifactRecord['contextPolicy'],
          citations: normalizeJsonb(version.citations_json) as string[],
          linkedDocId: version.linked_doc_id ? String(version.linked_doc_id) : null,
          lastExportedAt: version.last_exported_at ? toIsoString(version.last_exported_at) : null,
          updatedAt: new Date().toISOString(),
        };
        await persistArtifact(client, nextArtifact);
        return (await getArtifactWithExecutor(client, chatId, artifactId))!;
      });
    },
    async exportArtifactToDoc(chatId: string, artifactId: string, args: { mode: 'create_new' | 'update_linked' | 'create_or_update_linked'; title?: string }) {
      return runPostgresTransaction(executor, async (client) => {
        const transactionDocsRepo = createPostgresDocsRepository(validatedOwnerId, client);
        const artifact = await getArtifactWithExecutor(client, chatId, artifactId);
        if (!artifact) throw new Error(`Artifact "${artifactId}" was not found.`);
        const title = args.title?.trim() || artifact.title;
        const html = markdownToHtml(artifact.content, artifact.contextPolicy);
        const existing = artifact.linkedDocId ? await transactionDocsRepo.getDocBundle(artifact.linkedDocId) : null;
        let docId = existing?.doc.id ?? '';
        let action: 'created' | 'updated' = 'updated';

        if (args.mode === 'create_new' || (!existing && args.mode === 'create_or_update_linked')) {
          const created = await transactionDocsRepo.createImportedDoc(title, html);
          docId = created.doc.id;
          action = 'created';
        } else {
          if (!existing) throw new Error('This artifact does not have a linked document to update.');
          const tab = existing.tabs[0] as DocTabRecord;
          await transactionDocsRepo.saveDoc({
            doc: { ...existing.doc, title, updatedAt: new Date().toISOString(), lastOpenedAt: new Date().toISOString() },
            tab: { ...tab, content: html, contentFormat: 'html', textContent: artifact.content, updatedAt: new Date().toISOString() },
            version: { kind: 'named', label: `Artifact export - ${title}` },
          });
        }

        await persistArtifact(client, { ...artifact, linkedDocId: docId, lastExportedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        return { artifactId, docId, title, action, openUrl: `/docs/${docId}`, linkedDocId: docId };
      });
    },
    async deleteArtifact(chatId: string, artifactId: string) {
      await (executor as PostgresExecutor).query('DELETE FROM ai_artifacts WHERE owner_id = $1 AND id = $2 AND chat_id = $3', [validatedOwnerId, artifactId, chatId]);
    },
  };
}
