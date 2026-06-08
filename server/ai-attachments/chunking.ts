import { serverConfig } from '../config';
import { StoredAiAttachmentChunk } from './types';

const HEADING_PATTERN = /^(#{1,6})\s+(.*)$/;
const TOKEN_PATTERN = /[a-z0-9]{2,}/g;
const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'an', 'and', 'are', 'for', 'from', 'into', 'its', 'not', 'that', 'the', 'their', 'them', 'this', 'with']);

interface ChunkBuildResult {
  chunks: StoredAiAttachmentChunk[];
  outline: string[];
}

function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function splitParagraphs(markdown: string) {
  return normalizeWhitespace(markdown)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function pushChunk(chunks: StoredAiAttachmentChunk[], heading: string | null, text: string) {
  const content = normalizeWhitespace(text);
  if (!content) {
    return;
  }

  chunks.push({
    id: `chunk-${chunks.length + 1}`,
    heading,
    text: content,
  });
}

export function buildAttachmentChunks(markdown: string, maxChunkChars = 1400): ChunkBuildResult {
  const chunks: StoredAiAttachmentChunk[] = [];
  const outline: string[] = [];
  let currentHeading: string | null = null;
  let currentBuffer = '';

  for (const block of splitParagraphs(markdown)) {
    const headingMatch = block.match(HEADING_PATTERN);
    if (headingMatch) {
      pushChunk(chunks, currentHeading, currentBuffer);
      currentBuffer = '';
      currentHeading = headingMatch[2].trim();
      if (currentHeading) {
        outline.push(currentHeading);
      }
      continue;
    }

    const candidate = currentBuffer ? `${currentBuffer}\n\n${block}` : block;
    if (candidate.length > maxChunkChars && currentBuffer) {
      pushChunk(chunks, currentHeading, currentBuffer);
      currentBuffer = block;
      continue;
    }

    currentBuffer = candidate;
  }

  pushChunk(chunks, currentHeading, currentBuffer);
  return { chunks, outline };
}

function tokenize(value: string) {
  return (value.toLowerCase().match(TOKEN_PATTERN) ?? []).filter((token) => !STOP_WORDS.has(token));
}

function scoreChunk(tokens: string[], chunk: StoredAiAttachmentChunk) {
  if (!tokens.length) {
    return 0;
  }

  const haystack = `${chunk.heading ?? ''}\n${chunk.text}`.toLowerCase();
  return tokens.reduce((score, token) => {
    if (!haystack.includes(token)) {
      return score;
    }

    return score + (chunk.heading?.toLowerCase().includes(token) ? 3 : 1);
  }, 0);
}

function formatChunk(chunk: StoredAiAttachmentChunk) {
  return chunk.heading ? `### ${chunk.heading}\n${chunk.text}` : chunk.text;
}

export function buildAttachmentContext(args: {
  fileName: string;
  markdown: string;
  chunks: StoredAiAttachmentChunk[];
  outline: string[];
  query?: string;
}) {
  const baseHeader = [`Document: ${args.fileName}`, args.outline.length ? `Outline: ${args.outline.slice(0, 8).join(' | ')}` : null]
    .filter(Boolean)
    .join('\n');

  if (args.markdown.length <= serverConfig.aiAttachmentInlineChars) {
    return {
      context: `${baseHeader}\n\n${args.markdown}`.trim(),
      mode: 'inline' as const,
      selectedChunkCount: args.chunks.length,
    };
  }

  const queryTokens = tokenize(args.query ?? '');
  const rankedChunks = [...args.chunks]
    .map((chunk, index) => ({ chunk, index, score: scoreChunk(queryTokens, chunk) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, serverConfig.aiAttachmentTopChunks)
    .sort((left, right) => left.index - right.index)
    .map((item) => formatChunk(item.chunk));
  const chunkText = rankedChunks.join('\n\n').slice(0, serverConfig.aiAttachmentMaxContextChars).trim();

  return {
    context: `${baseHeader}\n\nSelected excerpts:\n${chunkText}`.trim(),
    mode: 'ranked' as const,
    selectedChunkCount: rankedChunks.length,
  };
}
