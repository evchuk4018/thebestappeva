import { NoteFilter, NoteSearchIndexEntry } from './notes-types';
import { readFilterCategory } from './notes-utils';

function matchesFilter(note: NoteSearchIndexEntry, filter: NoteFilter) {
  if (filter === 'all') return true;
  if (filter === 'pinned') return note.pinned;
  if (filter === 'unassigned') return !note.category;
  return note.category === readFilterCategory(filter);
}

export function filterNotes(notes: NoteSearchIndexEntry[], query: string, filter: NoteFilter) {
  const normalizedQuery = query.trim().toLowerCase();

  return notes
    .filter((note) => matchesFilter(note, filter))
    .filter((note) => {
      if (!normalizedQuery) return true;
      return `${note.title} ${note.plainTextBody} ${note.tags.join(' ')} ${note.category}`.toLowerCase().includes(normalizedQuery);
    });
}
