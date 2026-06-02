import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { listTaskCategories } from './task-manager/data';
import { NotesDetailScreen } from './notes/NotesDetailScreen';
import { NotesEditorScreen } from './notes/NotesEditorScreen';
import { NotesHomeScreen } from './notes/NotesHomeScreen';
import { notesRepository } from './notes/notes-repository';
import { filterNotes } from './notes/notes-search';
import { NoteDraft, NoteFilter, NoteScreen, NoteSearchIndexEntry } from './notes/notes-types';
import { buildCategoryFilter, buildNoteRecord, createNoteDraft } from './notes/notes-utils';

export default function NotesPage() {
  const navigate = useNavigate();
  const categories = useMemo(() => listTaskCategories(), []);
  const [activeFilter, setActiveFilter] = useState<NoteFilter>('all');
  const [draft, setDraft] = useState<NoteDraft>(createNoteDraft());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<NoteSearchIndexEntry[]>([]);
  const [query, setQuery] = useState('');
  const [screen, setScreen] = useState<NoteScreen>('home');
  const [selectedNoteId, setSelectedNoteId] = useState('');

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const editingNote = notes.find((note) => note.id === editingNoteId) ?? null;

  async function refresh() {
    await notesRepository.seedNotesIfEmpty();
    setNotes(await notesRepository.listNotes());
    setLoaded(true);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filters = useMemo(() => ([
    { id: 'all' as const, label: 'All', count: notes.length },
    { id: 'pinned' as const, label: 'Pinned', count: notes.filter((note) => note.pinned).length },
    { id: 'unassigned' as const, label: 'Quick notes', count: notes.filter((note) => !note.category).length },
    ...categories.map((category) => ({
      id: buildCategoryFilter(category),
      label: category,
      count: notes.filter((note) => note.category === category).length,
    })),
  ]), [categories, notes]);

  const visibleNotes = useMemo(() => filterNotes(notes, query, activeFilter), [activeFilter, notes, query]);
  const pinnedNotes = useMemo(() => visibleNotes.filter((note) => note.pinned), [visibleNotes]);
  const projectSummaries = useMemo(() => categories.map((category) => ({
    category,
    noteCount: notes.filter((note) => note.category === category).length,
  })), [categories, notes]);

  const openCreate = (category = '') => {
    setDraft(createNoteDraft(undefined, category));
    setEditingNoteId(null);
    setError('');
    setScreen('editor');
  };

  const openEdit = () => {
    if (!selectedNote) return;
    setDraft(createNoteDraft(selectedNote));
    setEditingNoteId(selectedNote.id);
    setError('');
    setScreen('editor');
  };

  const openNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setScreen('detail');
  };

  const saveDraft = async () => {
    if (!draft.title.trim() && !draft.body.trim()) {
      setError('Add a title or note body before saving.');
      return;
    }

    const nextNote = buildNoteRecord(draft, editingNote);
    await notesRepository.saveNote(nextNote);
    await refresh();
    setSelectedNoteId(nextNote.id);
    setScreen('detail');
    setError('');
  };

  const deleteNote = async (noteId: string) => {
    await notesRepository.deleteNote(noteId);
    await refresh();
    setSelectedNoteId('');
    setScreen('home');
  };

  const togglePin = async (noteId: string) => {
    await notesRepository.togglePin(noteId);
    await refresh();
  };

  const relinkCategory = async (category: string) => {
    if (!selectedNote) return;
    await notesRepository.saveNote({ ...selectedNote, category });
    await refresh();
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center bg-[linear-gradient(180deg,#f1e3c6_0%,#dfc08d_100%)]">
        <div className="rounded-full border border-black/10 bg-black/80 px-5 py-3 text-sm text-white/70">Loading notes…</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,248,229,0.95),rgba(255,248,229,0)_30%),radial-gradient(circle_at_bottom,rgba(214,170,91,0.26),rgba(214,170,91,0)_40%),linear-gradient(180deg,#f1dfbc_0%,#e2c48f_55%,#d7b375_100%)] p-0 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-[#111111] text-white md:rounded-[36px] md:border md:border-black/12 md:shadow-[0_30px_90px_rgba(41,24,0,0.28)]"
      >
        {screen === 'home' && (
          <NotesHomeScreen
            activeFilter={activeFilter}
            filters={filters}
            notes={visibleNotes}
            pinnedNotes={pinnedNotes}
            projects={projectSummaries}
            query={query}
            onCreate={openCreate}
            onFilterChange={setActiveFilter}
            onNavigateHome={() => navigate('/')}
            onOpenNote={openNote}
            onQueryChange={setQuery}
            onTogglePin={(noteId) => void togglePin(noteId)}
          />
        )}
        {screen === 'editor' && (
          <NotesEditorScreen
            availableCategories={categories}
            draft={draft}
            editing={Boolean(editingNoteId)}
            error={error}
            onBack={() => setScreen(editingNoteId ? 'detail' : 'home')}
            onDelete={editingNoteId ? () => void deleteNote(editingNoteId) : undefined}
            onDraftChange={(updater) => setDraft((currentDraft) => updater(currentDraft))}
            onSave={() => void saveDraft()}
          />
        )}
        {screen === 'detail' && (
          <NotesDetailScreen
            availableCategories={categories}
            note={selectedNote}
            onBack={() => setScreen('home')}
            onDelete={() => selectedNote && void deleteNote(selectedNote.id)}
            onEdit={openEdit}
            onRelink={(category) => void relinkCategory(category)}
            onTogglePin={() => selectedNote && void togglePin(selectedNote.id)}
          />
        )}
      </motion.div>
    </div>
  );
}
