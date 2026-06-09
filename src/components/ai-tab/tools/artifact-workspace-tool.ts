import {
  ArtifactContextPolicy,
  UpdateArtifactRequest,
  UpdateArtifactTableRequest,
} from '../../../../shared/ai-artifacts-contract';
import {
  createArtifact,
  exportArtifactToDoc,
  fetchArtifactLines,
  getArtifactOutline,
  listArtifacts,
  searchArtifact,
  updateArtifact,
  updateArtifactTable,
} from '../../../lib/ai-artifacts-storage';
import { ToolExecutionContext, ToolRegistryEntry } from './types';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildArtifactCard(artifact: { artifactId: string; title: string; type: string; updatedAt: string; lineCount: number; charCount: number; preview?: string; linkedDocId?: string | null }) {
  return {
    artifactId: artifact.artifactId,
    title: artifact.title,
    type: artifact.type,
    updatedAt: artifact.updatedAt,
    lineCount: artifact.lineCount,
    charCount: artifact.charCount,
    preview: artifact.preview,
    linkedDocId: artifact.linkedDocId ?? null,
  };
}

function normalizeContextPolicy(value: unknown): ArtifactContextPolicy | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return {
    mode: (readString(record.mode) || 'chunked') as ArtifactContextPolicy['mode'],
    maxChars: typeof record.maxChars === 'number' ? record.maxChars : undefined,
    chunkSize: typeof record.chunkSize === 'number' ? record.chunkSize : undefined,
    overlap: typeof record.overlap === 'number' ? record.overlap : undefined,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
  };
}

function toData(value: unknown) {
  return value as Record<string, unknown>;
}

export function createArtifactWorkspaceTool(chatId: string): ToolRegistryEntry {
  return {
    definition: {
      id: 'artifact-workspace',
      label: 'Artifacts',
      alias: '/artifacts',
      description: 'Creates, reads, searches, edits, versions, and exports Markdown artifacts attached to the current chat.',
      enabledByDefault: true,
      automatic: true,
      functions: [
        { name: 'create_artifact', description: 'Create a Markdown artifact for this chat.', parameters: [{ name: 'title', type: 'string', description: 'Artifact title.', required: true }, { name: 'type', type: 'string', description: 'Artifact type label.', required: true }, { name: 'content', type: 'string', description: 'Full Markdown body.', required: true }] },
        { name: 'fetch_artifact_lines', description: 'Fetch an exact line range from one artifact.', parameters: [{ name: 'artifactId', type: 'string', description: 'Artifact ID.', required: true }, { name: 'startLine', type: 'number', description: 'One-based first line.', required: true }, { name: 'endLine', type: 'number', description: 'One-based last line.', required: true }] },
        { name: 'list_artifacts', description: 'List artifacts attached to the current chat.', parameters: [{ name: 'sessionId', type: 'string', description: 'Optional session override; defaults to the current chat.' }, { name: 'includePreview', type: 'boolean', description: 'Include compact preview text when true.' }] },
        {
          name: 'update_artifact',
          description: 'Update artifact metadata, replace full Markdown, or apply a targeted patch.',
          parameters: [
            { name: 'artifactId', type: 'string', description: 'Artifact ID.', required: true },
            { name: 'title', type: 'string', description: 'Optional artifact title.' },
            { name: 'type', type: 'string', description: 'Optional artifact type label.' },
            {
              name: 'contextPolicy',
              type: 'object',
              description: 'Optional context policy override.',
              schema: {
                type: 'object',
                description: 'Optional context policy override.',
                properties: {
                  mode: { type: 'string', enum: ['full', 'chunked', 'selection', 'summary'] },
                  maxChars: { type: 'number' },
                  chunkSize: { type: 'number' },
                  overlap: { type: 'number' },
                  summary: { type: 'string' },
                },
              },
            },
            { name: 'content', type: 'string', description: 'Optional full Markdown replacement.' },
            {
              name: 'patch',
              type: 'object',
              description: 'Optional targeted patch request.',
              schema: {
                type: 'object',
                properties: {
                  mode: { type: 'string', enum: ['replace_lines', 'replace_range', 'replace_section', 'append', 'prepend'] },
                  startLine: { type: 'number' },
                  endLine: { type: 'number' },
                  startOffset: { type: 'number' },
                  endOffset: { type: 'number' },
                  sectionHeading: { type: 'string' },
                  text: { type: 'string' },
                },
                required: ['mode', 'text'],
              },
            },
            { name: 'reason', type: 'string', description: 'Reason for the edit.', required: true },
          ],
        },
        { name: 'search_artifact', description: 'Search one artifact by keyword, heading, or hybrid matching.', parameters: [{ name: 'artifactId', type: 'string', description: 'Artifact ID.', required: true }, { name: 'query', type: 'string', description: 'Search query.', required: true }, { name: 'limit', type: 'number', description: 'Maximum matches to return.' }, { name: 'mode', type: 'string', description: 'keyword, heading, or hybrid.' }] },
        { name: 'get_artifact_outline', description: 'Return the Markdown heading outline for one artifact.', parameters: [{ name: 'artifactId', type: 'string', description: 'Artifact ID.', required: true }] },
        { name: 'export_artifact_to_doc', description: 'Create or update a document in /docs from one Markdown artifact.', parameters: [{ name: 'artifactId', type: 'string', description: 'Artifact ID.', required: true }, { name: 'mode', type: 'string', description: 'create_new, update_linked, or create_or_update_linked.' }, { name: 'title', type: 'string', description: 'Optional export title override.' }] },
        {
          name: 'update_artifact_table',
          description: 'Perform a structured table edit without corrupting surrounding Markdown.',
          parameters: [
            { name: 'artifactId', type: 'string', description: 'Artifact ID.', required: true },
            {
              name: 'tableLocator',
              type: 'object',
              description: 'Heading/index or line range locator for the target table.',
              required: true,
              schema: {
                type: 'object',
                properties: {
                  heading: { type: 'string' },
                  tableIndex: { type: 'number' },
                  startLine: { type: 'number' },
                  endLine: { type: 'number' },
                },
              },
            },
            {
              name: 'operation',
              type: 'string',
              description: 'Structured table operation.',
              required: true,
              schema: { type: 'string', enum: ['create_table', 'insert_row_above', 'insert_row_below', 'delete_row', 'insert_column_left', 'insert_column_right', 'delete_column', 'update_cell', 'replace_table'] },
            },
            { name: 'rowIndex', type: 'number', description: 'Optional zero-based row index.' },
            { name: 'columnIndex', type: 'number', description: 'Optional zero-based column index.' },
            { name: 'cellText', type: 'string', description: 'Optional replacement cell text.' },
            { name: 'headers', type: 'array', description: 'Optional header cells.', schema: { type: 'array', items: { type: 'string' } } },
            { name: 'rows', type: 'array', description: 'Optional table rows.', schema: { type: 'array', items: { type: 'array', items: { type: 'string' } } } },
            { name: 'markdownTable', type: 'string', description: 'Optional full Markdown table replacement.' },
            { name: 'reason', type: 'string', description: 'Reason for the table edit.', required: true },
          ],
        },
      ],
    },
    async execute(invocation, _context: ToolExecutionContext) {
      if (invocation.functionName === 'create_artifact') {
        const artifact = await createArtifact(chatId, {
          title: readString(invocation.args.title),
          type: readString(invocation.args.type) || 'markdown',
          content: readString(invocation.args.content),
          contextPolicy: normalizeContextPolicy(invocation.args.contextPolicy),
          citations: Array.isArray(invocation.args.citations) ? invocation.args.citations.map(String) : undefined,
        });
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Created artifact "${artifact.title}".`,
          data: toData({ artifact: buildArtifactCard(artifact), artifactCard: buildArtifactCard(artifact) }),
        };
      }

      if (invocation.functionName === 'fetch_artifact_lines') {
        const result = await fetchArtifactLines(chatId, readString(invocation.args.artifactId), Number(invocation.args.startLine), Number(invocation.args.endLine));
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Loaded lines ${result.startLine}-${result.endLine} from "${result.title}".`, data: toData(result) };
      }

      if (invocation.functionName === 'list_artifacts') {
        const artifacts = await listArtifacts(readString(invocation.args.sessionId) || chatId, Boolean(invocation.args.includePreview));
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Found ${artifacts.length} artifact${artifacts.length === 1 ? '' : 's'} in this chat.`,
          data: toData({ artifacts, artifactCards: artifacts.map(buildArtifactCard) }),
        };
      }

      if (invocation.functionName === 'update_artifact') {
        const request: UpdateArtifactRequest = {
          artifactId: readString(invocation.args.artifactId),
          title: readString(invocation.args.title) || undefined,
          type: readString(invocation.args.type) || undefined,
          contextPolicy: normalizeContextPolicy(invocation.args.contextPolicy),
          content: typeof invocation.args.content === 'string' ? invocation.args.content : undefined,
          patch: invocation.args.patch && typeof invocation.args.patch === 'object' ? invocation.args.patch as UpdateArtifactRequest['patch'] : undefined,
          reason: readString(invocation.args.reason),
        };
        const result = await updateArtifact(chatId, request);
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Updated artifact "${result.artifact.title}".`,
          data: toData({ ...result, artifactCard: buildArtifactCard(result.artifact) }),
        };
      }

      if (invocation.functionName === 'search_artifact') {
        const result = await searchArtifact(chatId, readString(invocation.args.artifactId), readString(invocation.args.query), (readString(invocation.args.mode) || 'keyword') as 'keyword' | 'heading' | 'hybrid', typeof invocation.args.limit === 'number' ? invocation.args.limit : 10);
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Found ${result.totalMatches} matches in "${result.title}".`, data: toData(result) };
      }

      if (invocation.functionName === 'get_artifact_outline') {
        const result = await getArtifactOutline(chatId, readString(invocation.args.artifactId));
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Loaded outline for "${result.title}".`, data: toData(result) };
      }

      if (invocation.functionName === 'export_artifact_to_doc') {
        const result = await exportArtifactToDoc(chatId, readString(invocation.args.artifactId), (readString(invocation.args.mode) || 'create_or_update_linked') as 'create_new' | 'update_linked' | 'create_or_update_linked', readString(invocation.args.title) || undefined);
        return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `${result.action === 'created' ? 'Created' : 'Updated'} /docs document "${result.title}".`, data: toData(result) };
      }

      const request = {
        artifactId: readString(invocation.args.artifactId),
        tableLocator: invocation.args.tableLocator && typeof invocation.args.tableLocator === 'object' ? invocation.args.tableLocator as UpdateArtifactTableRequest['tableLocator'] : { tableIndex: 0 },
        operation: readString(invocation.args.operation) as UpdateArtifactTableRequest['operation'],
        rowIndex: typeof invocation.args.rowIndex === 'number' ? invocation.args.rowIndex : undefined,
        columnIndex: typeof invocation.args.columnIndex === 'number' ? invocation.args.columnIndex : undefined,
        cellText: typeof invocation.args.cellText === 'string' ? invocation.args.cellText : undefined,
        headers: Array.isArray(invocation.args.headers) ? invocation.args.headers.map(String) : undefined,
        rows: Array.isArray(invocation.args.rows) ? invocation.args.rows.map((row) => Array.isArray(row) ? row.map(String) : []) : undefined,
        markdownTable: typeof invocation.args.markdownTable === 'string' ? invocation.args.markdownTable : undefined,
        reason: readString(invocation.args.reason),
      } satisfies UpdateArtifactTableRequest;
      const result = await updateArtifactTable(chatId, request);
      return { toolId: invocation.toolId, functionName: invocation.functionName, ok: true, summary: `Updated a table in "${result.artifact.title}".`, data: toData({ ...result, artifactCard: buildArtifactCard(result.artifact) }) };
    },
  };
}
