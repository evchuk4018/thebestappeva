import { ArtifactChangedRange, UpdateArtifactTableRequest } from '../shared/ai-artifacts-contract';
import { buildOutline, splitMarkdownLines } from './ai-artifacts-markdown';

const tablePattern = /^\s*\|.*\|\s*$/;

function parseCells(line: string) {
  return line.split('|').slice(1, -1).map((cell) => cell.trim());
}

function stringifyTable(headers: string[], rows: string[][]) {
  const separator = headers.map(() => '---');
  return [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function findTableRange(lines: string[], request: UpdateArtifactTableRequest) {
  if ('startLine' in request.tableLocator) {
    return { startLine: request.tableLocator.startLine, endLine: request.tableLocator.endLine };
  }

  const heading = request.tableLocator.heading?.trim().toLowerCase();
  const tableIndex = request.tableLocator.tableIndex ?? 0;
  const outline = buildOutline(lines.join('\n'));
  const scope = heading ? outline.find((entry) => entry.heading.toLowerCase() === heading) : null;
  const start = scope?.lineStart ?? 1;
  const end = scope?.lineEnd ?? lines.length;
  let seen = -1;

  for (let index = start - 1; index < end; index += 1) {
    if (tablePattern.test(lines[index]) && index + 1 < end && tablePattern.test(lines[index + 1])) {
      seen += 1;
      if (seen === tableIndex) {
        let stop = index + 1;
        while (stop + 1 < lines.length && tablePattern.test(lines[stop + 1])) stop += 1;
        return { startLine: index + 1, endLine: stop + 1 };
      }
    }
  }

  throw new Error('Unable to locate the requested Markdown table.');
}

export function applyTableOperation(content: string, request: UpdateArtifactTableRequest): { content: string; tableRange: ArtifactChangedRange } {
  const lines = splitMarkdownLines(content);
  const range = findTableRange(lines, request);
  const tableLines = lines.slice(range.startLine - 1, range.endLine);
  const headers = parseCells(tableLines[0] ?? '| |');
  const rows = tableLines.slice(2).map(parseCells);
  let replacementLines: string[] = [];

  if (request.operation === 'replace_table') {
    if (!request.markdownTable) throw new Error('replace_table requires markdownTable.');
    replacementLines = splitMarkdownLines(request.markdownTable);
  } else if (request.operation === 'create_table') {
    const nextHeaders = request.headers?.length ? request.headers : ['Column 1', 'Column 2'];
    const nextRows = request.rows?.length ? request.rows : [['', '']];
    replacementLines = splitMarkdownLines(stringifyTable(nextHeaders, nextRows));
  } else {
    const rowIndex = request.rowIndex ?? 0;
    const columnIndex = request.columnIndex ?? 0;
    if (request.operation === 'insert_row_above') rows.splice(rowIndex, 0, headers.map(() => ''));
    if (request.operation === 'insert_row_below') rows.splice(rowIndex + 1, 0, headers.map(() => ''));
    if (request.operation === 'delete_row') rows.splice(rowIndex, 1);
    if (request.operation === 'insert_column_left') {
      headers.splice(columnIndex, 0, 'Column');
      rows.forEach((row) => row.splice(columnIndex, 0, ''));
    }
    if (request.operation === 'insert_column_right') {
      headers.splice(columnIndex + 1, 0, 'Column');
      rows.forEach((row) => row.splice(columnIndex + 1, 0, ''));
    }
    if (request.operation === 'delete_column') {
      headers.splice(columnIndex, 1);
      rows.forEach((row) => row.splice(columnIndex, 1));
    }
    if (request.operation === 'update_cell') {
      if (typeof request.cellText !== 'string') throw new Error('update_cell requires cellText.');
      rows[rowIndex] = rows[rowIndex] ?? headers.map(() => '');
      rows[rowIndex][columnIndex] = request.cellText;
    }
    replacementLines = splitMarkdownLines(stringifyTable(headers, rows));
  }

  lines.splice(range.startLine - 1, range.endLine - range.startLine + 1, ...replacementLines);
  return {
    content: lines.join('\n'),
    tableRange: { startLine: range.startLine, endLine: range.startLine + replacementLines.length - 1 },
  };
}
