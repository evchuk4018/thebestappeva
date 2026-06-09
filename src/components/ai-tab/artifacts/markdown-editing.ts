export interface TextSelectionRange {
  start: number;
  end: number;
}

function sliceSelection(value: string, selection: TextSelectionRange) {
  return {
    before: value.slice(0, selection.start),
    selected: value.slice(selection.start, selection.end),
    after: value.slice(selection.end),
  };
}

export function wrapSelection(value: string, selection: TextSelectionRange, beforeText: string, afterText = beforeText) {
  const parts = sliceSelection(value, selection);
  const selected = parts.selected || 'text';
  const nextValue = `${parts.before}${beforeText}${selected}${afterText}${parts.after}`;
  return {
    value: nextValue,
    selection: { start: selection.start + beforeText.length, end: selection.start + beforeText.length + selected.length },
  };
}

export function toggleLinePrefix(value: string, selection: TextSelectionRange, prefix: string) {
  const start = value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const endBreak = value.indexOf('\n', selection.end);
  const end = endBreak === -1 ? value.length : endBreak;
  const block = value.slice(start, end);
  const lines = block.split('\n');
  const shouldRemove = lines.every((line) => line.startsWith(prefix));
  const nextBlock = lines.map((line) => shouldRemove ? line.slice(prefix.length) : `${prefix}${line}`).join('\n');
  return {
    value: `${value.slice(0, start)}${nextBlock}${value.slice(end)}`,
    selection: { start, end: start + nextBlock.length },
  };
}

export function insertLink(value: string, selection: TextSelectionRange) {
  const label = value.slice(selection.start, selection.end) || 'link text';
  const link = `[${label}](https://example.com)`;
  return {
    value: `${value.slice(0, selection.start)}${link}${value.slice(selection.end)}`,
    selection: { start: selection.start + 1, end: selection.start + 1 + label.length },
  };
}

export function buildMarkdownTable(columnCount = 2, rowCount = 2) {
  const headers = Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
  const rows = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''));
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

export function insertTable(value: string, selection: TextSelectionRange, columnCount = 2, rowCount = 2) {
  const table = buildMarkdownTable(columnCount, rowCount);
  const prefix = selection.start > 0 && value[selection.start - 1] !== '\n' ? '\n' : '';
  const suffix = selection.end < value.length && value[selection.end] !== '\n' ? '\n' : '';
  const nextValue = `${value.slice(0, selection.start)}${prefix}${table}${suffix}${value.slice(selection.end)}`;
  const start = selection.start + prefix.length;
  return { value: nextValue, selection: { start, end: start + table.length } };
}

export function lineNumberAtOffset(value: string, offset: number) {
  return value.slice(0, Math.max(0, offset)).split('\n').length;
}

export function locateTableAroundSelection(value: string, selection: TextSelectionRange) {
  const lines = value.replace(/\r/g, '').split('\n');
  const currentLine = lineNumberAtOffset(value, selection.start);
  const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line);
  if (!isTableLine(lines[currentLine - 1] ?? '')) {
    return null;
  }

  let startLine = currentLine;
  let endLine = currentLine;
  while (startLine > 1 && isTableLine(lines[startLine - 2] ?? '')) startLine -= 1;
  while (endLine < lines.length && isTableLine(lines[endLine] ?? '')) endLine += 1;

  const currentRowIndex = Math.max(0, currentLine - startLine - 1);
  const lineStartOffset = value.lastIndexOf('\n', Math.max(0, selection.start - 1)) + 1;
  const currentLineText = value.slice(lineStartOffset, value.indexOf('\n', selection.start) === -1 ? value.length : value.indexOf('\n', selection.start));
  const withinLineOffset = selection.start - lineStartOffset;
  const columnIndex = Math.max(0, currentLineText.slice(0, withinLineOffset).split('|').length - 2);
  return { startLine, endLine, rowIndex: currentRowIndex, columnIndex };
}

export function insertCodeBlock(value: string, selection: TextSelectionRange) {
  const parts = sliceSelection(value, selection);
  const selected = parts.selected || 'code';
  const block = `\`\`\`\n${selected}\n\`\`\``;
  return {
    value: `${parts.before}${block}${parts.after}`,
    selection: { start: selection.start + 4, end: selection.start + 4 + selected.length },
  };
}
