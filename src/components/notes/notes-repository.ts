import { createSeedNotes } from './notes-data';
import { notesDb } from './notes-db';
import { NoteRecord, NotesRepository } from './notes-types';
import { buildNotePreview, createNoteId, toPlainText } from './notes-utils';

function sortNotes(notes: NoteRecord[]) {
  return [...notes].sort((left, right) => {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export const notesRepository: NotesRepository = {
  async listNotes() {
    return sortNotes(await notesDb.notes.toArray()).map((note) => ({
      ...note,
      preview: buildNotePreview(note.body),
    }));
  },
  async createNote(seed = {}) {
    const timestamp = new Date().toISOString();
    const body = seed.body?.trim() ?? '';
    const note: NoteRecord = {
      id: seed.id ?? createNoteId('note'),
      title: seed.title?.trim() || 'Quick note',
      body,
      plainTextBody: toPlainText(body),
      category: seed.category?.trim() ?? '',
      tags: seed.tags ?? [],
      pinned: seed.pinned ?? false,
      createdAt: seed.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    await notesDb.notes.add(note);
    return note;
  },
  async getNote(id) {
    return (await notesDb.notes.get(id)) ?? null;
  },
  async saveNote(note) {
    const body = note.body.trim();
    await notesDb.notes.put({
      ...note,
      title: note.title.trim() || 'Quick note',
      body,
      plainTextBody: toPlainText(body),
      updatedAt: new Date().toISOString(),
    });
  },
  async deleteNote(id) {
    await notesDb.notes.delete(id);
  },
  async togglePin(id) {
    const note = await notesDb.notes.get(id);
    if (!note) return;
    await notesDb.notes.put({ ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() });
  },
  async seedNotesIfEmpty() {
    await notesDb.transaction('rw', notesDb.notes, async () => {
      const count = await notesDb.notes.count();
      if (count > 0) return;
      await notesDb.notes.bulkAdd(createSeedNotes());
    });
  },
};
