import Dexie, { Table } from 'dexie';
import { NoteRecord } from './notes-types';

class NotesDatabase extends Dexie {
  notes!: Table<NoteRecord, string>;

  constructor() {
    super('notes-workspace');
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt, pinned, category',
    });
  }
}

export const notesDb = new NotesDatabase();
