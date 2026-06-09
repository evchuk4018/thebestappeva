import {
  ArtifactChangedRange,
  ArtifactContextPolicy,
  ArtifactOutlineEntry,
  ArtifactPatchRequest,
  ArtifactSearchMatch,
  ArtifactSearchMode,
} from '../shared/ai-artifacts-contract';

const headingPattern = /^(#{1,6})\s+(.*)$/;
const lineTablePattern = /^\s*\|.*\|\s*$/;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function normalizeMarkdown(value: string) {
  return value.replace(/\r/g, '').trimEnd();
}

export function splitMarkdownLines(value: string) {
  return normalizeMarkdown(value).split('\n');
}

export function countMarkdownLines(value: string) {
  return splitMarkdownLines(value).length;
}

export function summarizeMarkdown(value: string, maxChars = 220) {
  const preview = normalizeMarkdown(value).replace(/\s+/g, ' ').trim();
  return preview.length > maxChars ? `${preview.slice(0, maxChars - 1)}…` : preview;
}

export function buildOutline(value: string): ArtifactOutlineEntry[] {
  const lines = splitMarkdownLines(value);
  const entries = lines.flatMap((line, index) => {
    const match = line.match(headingPattern);
    return match ? [{ heading: match[2].trim(), level: match[1].length, lineStart: index + 1, preview: '' }] : [];
  });

  return entries.map((entry, index) => ({
    ...entry,
    lineEnd: index < entries.length - 1 ? entries[index + 1].lineStart - 1 : lines.length,
    preview: summarizeMarkdown(lines.slice(entry.lineStart, Math.min(lines.length, entry.lineStart + 2)).join(' '), 120),
  }));
}

function findLineOffsets(lines: string[], lineNumber: number) {
  let offset = 0;
  for (let index = 0; index < Math.max(0, lineNumber - 1); index += 1) {
    offset += lines[index].length + 1;
  }
  return offset;
}

function toRange(lines: string[], startLine: number, endLine: number) {
  const safeStart = Math.max(1, startLine);
  const safeEnd = Math.max(safeStart, Math.min(lines.length, endLine));
  const startOffset = findLineOffsets(lines, safeStart);
  const endOffset = findLineOffsets(lines, safeEnd + 1) - (safeEnd < lines.length ? 1 : 0);
  return { startLine: safeStart, endLine: safeEnd, startOffset, endOffset };
}

function replaceSlice(content: string, startOffset: number, endOffset: number, text: string) {
  return `${content.slice(0, startOffset)}${text}${content.slice(endOffset)}`;
}

export function applyPatch(content: string, patch: ArtifactPatchRequest): { content: string; changedRange: ArtifactChangedRange } {
  const normalized = normalizeMarkdown(content);
  const lines = splitMarkdownLines(normalized);

  if (patch.mode === 'append') {
    const text = normalized ? `\n${patch.text}` : patch.text;
    return { content: `${normalized}${text}`.trimStart(), changedRange: { startLine: lines.length, endLine: countMarkdownLines(text) + lines.length } };
  }

  if (patch.mode === 'prepend') {
    const text = normalized ? `${patch.text}\n` : patch.text;
    return { content: `${text}${normalized}`.trimEnd(), changedRange: { startLine: 1, endLine: countMarkdownLines(text) } };
  }

  if (patch.mode === 'replace_range') {
    if (typeof patch.startOffset !== 'number' || typeof patch.endOffset !== 'number' || patch.endOffset < patch.startOffset) {
      throw new Error('replace_range requires valid startOffset and endOffset values.');
    }
    const nextContent = replaceSlice(normalized, patch.startOffset, patch.endOffset, patch.text);
    const startLine = normalized.slice(0, patch.startOffset).split('\n').length;
    return { content: nextContent, changedRange: { startLine, endLine: startLine + countMarkdownLines(patch.text) - 1 } };
  }

  if (patch.mode === 'replace_lines') {
    if (typeof patch.startLine !== 'number' || typeof patch.endLine !== 'number' || patch.endLine < patch.startLine) {
      throw new Error('replace_lines requires valid startLine and endLine values.');
    }
    const range = toRange(lines, patch.startLine, patch.endLine);
    return {
      content: replaceSlice(normalized, range.startOffset, range.endOffset, patch.text),
      changedRange: { startLine: range.startLine, endLine: range.startLine + countMarkdownLines(patch.text) - 1 },
    };
  }

  const outline = buildOutline(normalized);
  const match = outline.filter((entry) => entry.heading.toLowerCase() === (patch.sectionHeading ?? '').trim().toLowerCase());
  if (match.length !== 1) {
    throw new Error('replace_section requires exactly one matching section heading.');
  }

  const target = match[0];
  const bodyStart = target.lineStart + (patch.text.trimStart().startsWith('#') ? 0 : 1);
  const bodyLines = patch.text.trimStart().startsWith('#') ? patch.text : `${splitMarkdownLines(normalized)[target.lineStart - 1]}\n${patch.text}`;
  const range = toRange(lines, target.lineStart, target.lineEnd ?? lines.length);
  return {
    content: replaceSlice(normalized, range.startOffset, range.endOffset, bodyLines),
    changedRange: { startLine: bodyStart, endLine: bodyStart + countMarkdownLines(patch.text) - 1 },
  };
}

export function fetchLines(content: string, startLine: number, endLine: number) {
  const lines = splitMarkdownLines(content);
  const safeStart = Math.max(1, startLine);
  const safeEnd = Math.max(safeStart, Math.min(lines.length, endLine));
  return { startLine: safeStart, endLine: safeEnd, lines: lines.slice(safeStart - 1, safeEnd) };
}

export function searchMarkdown(content: string, query: string, mode: ArtifactSearchMode, limit = 10): ArtifactSearchMatch[] {
  const lines = splitMarkdownLines(content);
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const outline = buildOutline(content);
  const headingMatches = mode === 'keyword' ? [] : outline
    .filter((entry) => entry.heading.toLowerCase().includes(normalizedQuery))
    .map((entry) => ({
      lineStart: entry.lineStart,
      lineEnd: entry.lineEnd ?? entry.lineStart,
      snippet: `${'#'.repeat(entry.level)} ${entry.heading}`,
      matchType: (mode === 'heading' ? 'heading' : 'hybrid') as ArtifactSearchMatch['matchType'],
    }));

  const keywordMatches = mode === 'heading' ? [] : lines.flatMap((line, index) => (
    line.toLowerCase().includes(normalizedQuery)
      ? [{ lineStart: index + 1, lineEnd: index + 1, snippet: line.trim(), matchType: (mode === 'keyword' ? 'keyword' : 'hybrid') as ArtifactSearchMatch['matchType'] }]
      : []
  ));

  return [...headingMatches, ...keywordMatches].slice(0, Math.max(1, Math.min(50, limit)));
}

function renderInline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function renderTable(lines: string[], startIndex: number) {
  const rows: string[] = [];
  let index = startIndex;
  while (index < lines.length && lineTablePattern.test(lines[index])) {
    rows.push(lines[index]);
    index += 1;
  }
  const cells = rows.map((row) => row.split('|').slice(1, -1).map((cell) => renderInline(cell.trim())));
  const headers = cells[0] ?? [];
  const bodyRows = cells.slice(2);
  const html = `<table><thead><tr>${headers.map((cell) => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return { html, nextIndex: index - 1 };
}

export function markdownToHtml(content: string, _policy?: ArtifactContextPolicy) {
  const lines = splitMarkdownLines(content);
  const html: string[] = [];
  let inCodeBlock = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      html.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('```')) {
      flushList();
      html.push(inCodeBlock ? '</code></pre>' : '<pre><code>');
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      html.push(`${escapeHtml(line)}\n`);
      continue;
    }
    if (lineTablePattern.test(line) && index + 1 < lines.length && lineTablePattern.test(lines[index + 1])) {
      flushList();
      const table = renderTable(lines, index);
      html.push(table.html);
      index = table.nextIndex;
      continue;
    }
    const heading = line.match(headingPattern);
    if (heading) {
      flushList();
      html.push(`<h${heading[1].length}>${renderInline(heading[2].trim())}</h${heading[1].length}>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      listItems.push(`<li>${renderInline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    if (line.startsWith('> ')) {
      html.push(`<blockquote>${renderInline(line.slice(2).trim())}</blockquote>`);
      continue;
    }
    html.push(`<p>${renderInline(line.trim())}</p>`);
  }

  flushList();
  return html.join('');
}
