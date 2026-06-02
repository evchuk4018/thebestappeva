import { NoteDraft, NoteFilter, NoteRecord } from './notes-types';

export const unassignedCategoryLabel = 'Unassigned';

export function createNoteId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function toPlainText(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

export function buildNotePreview(value: string, maxLength = 116) {
  const plainText = toPlainText(value);
  if (plainText.length <= maxLength) return plainText;
  return `${plainText.slice(0, maxLength).trimEnd()}…`;
}

export function normalizeTags(tagsInput: string) {
  return [...new Set(tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

export function deriveNoteTitle(title: string, body: string) {
  if (title.trim()) return title.trim();
  const firstLine = body.split('\n').map((line) => line.trim()).find(Boolean);
  if (firstLine) return firstLine.slice(0, 64);
  return 'Quick note';
}

export function createNoteDraft(note?: NoteRecord, category = ''): NoteDraft {
  if (!note) {
    return {
      title: '',
      body: '',
      tagsInput: '',
      category,
      pinned: false,
    };
  }

  return {
    title: note.title,
    body: note.body,
    tagsInput: note.tags.join(', '),
    category: note.category,
    pinned: note.pinned,
  };
}

export function buildNoteRecord(draft: NoteDraft, current?: NoteRecord | null): NoteRecord {
  const body = draft.body.trim();
  const timestamp = new Date().toISOString();

  return {
    id: current?.id ?? createNoteId('note'),
    title: deriveNoteTitle(draft.title, body),
    body,
    plainTextBody: toPlainText(body),
    category: draft.category.trim(),
    tags: normalizeTags(draft.tagsInput),
    pinned: draft.pinned,
    createdAt: current?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function formatNoteDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function buildCategoryFilter(category: string) {
  return `category:${category}` as NoteFilter;
}

export function readFilterCategory(filter: NoteFilter) {
  return filter.startsWith('category:') ? filter.slice('category:'.length) : '';
}

export function getCategoryLabel(category: string) {
  return category || unassignedCategoryLabel;
}
