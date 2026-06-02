export type NoteFilter = 'all' | 'pinned' | 'unassigned' | `category:${string}`;
export type NoteScreen = 'home' | 'detail' | 'editor';

export interface NoteRecord {
  id: string;
  title: string;
  body: string;
  plainTextBody: string;
  category: string;
  tags: string[];
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDraft {
  title: string;
  body: string;
  tagsInput: string;
  category: string;
  pinned: boolean;
}

export interface NoteSearchIndexEntry extends NoteRecord {
  preview: string;
}

export interface NoteFilterOption {
  id: NoteFilter;
  label: string;
  count: number;
}

export interface NotesRepository {
  listNotes(): Promise<NoteSearchIndexEntry[]>;
  createNote(seed?: Partial<NoteRecord>): Promise<NoteRecord>;
  getNote(id: string): Promise<NoteRecord | null>;
  saveNote(note: NoteRecord): Promise<void>;
  deleteNote(id: string): Promise<void>;
  togglePin(id: string): Promise<void>;
  seedNotesIfEmpty(): Promise<void>;
}
