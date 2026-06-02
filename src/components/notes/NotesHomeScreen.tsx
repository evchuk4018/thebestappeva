import { Home, Plus, Search } from 'lucide-react';
import { NoteFilter, NoteFilterOption, NoteSearchIndexEntry } from './notes-types';
import { getCategoryLabel } from './notes-utils';
import { NoteCard } from './NoteCard';
import { NotesFilterChips } from './NotesFilterChips';
import { NotesProjectRail } from './NotesProjectRail';

interface NotesHomeScreenProps {
  activeFilter: NoteFilter;
  filters: NoteFilterOption[];
  notes: NoteSearchIndexEntry[];
  pinnedNotes: NoteSearchIndexEntry[];
  projects: Array<{ category: string; noteCount: number }>;
  query: string;
  onCreate: (category?: string) => void;
  onFilterChange: (filter: NoteFilter) => void;
  onNavigateHome: () => void;
  onOpenNote: (noteId: string) => void;
  onQueryChange: (query: string) => void;
  onTogglePin: (noteId: string) => void;
}

export function NotesHomeScreen({
  activeFilter,
  filters,
  notes,
  pinnedNotes,
  projects,
  query,
  onCreate,
  onFilterChange,
  onNavigateHome,
  onOpenNote,
  onQueryChange,
  onTogglePin,
}: NotesHomeScreenProps) {
  const showSections = !query.trim() && activeFilter === 'all';
  const recentNotes = showSections ? notes.filter((note) => !note.pinned) : notes;

  return (
    <>
      <header className="border-b border-white/6 px-5 pb-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-[#d8b15d]">Notes</p>
            <h1 className="mt-2 text-[1.75rem] font-semibold text-white">My notes</h1>
          </div>
          <button
            type="button"
            onClick={() => onCreate()}
            className="rounded-full border border-[#d8b15d]/30 bg-[#d8b15d]/10 p-3 text-[#f4d793] transition hover:border-[#d8b15d]/55"
            aria-label="Create note"
          >
            <Plus size={18} />
          </button>
        </div>
        <label className="mt-5 flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-4 py-3 text-white/64">
          <Search size={17} className="text-white/36" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search ideas, tags, or projects"
            className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
          />
        </label>
        <div className="mt-4">
          <NotesFilterChips activeFilter={activeFilter} filters={filters} onChange={onFilterChange} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-28 pt-5">
        <section className="rounded-[28px] border border-[#d8b15d]/16 bg-[linear-gradient(180deg,rgba(216,177,93,0.12)_0%,rgba(18,18,18,0)_100%)] p-5">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#d8b15d]">Quick capture</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Get the thought down first.</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-white/62">Save a quick note now, or jump into a project and keep related ideas together.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => onCreate()} className="rounded-full bg-[#f1cf82] px-4 py-2 text-sm font-medium text-[#17130b]">
              Quick note
            </button>
            <button type="button" onClick={() => onFilterChange('unassigned')} className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/72">
              View quick notes
            </button>
          </div>
        </section>

        <div className="mt-6">
          <NotesProjectRail activeFilter={activeFilter} projects={projects} onCreate={(category) => onCreate(category)} onSelect={onFilterChange} />
        </div>

        {showSections && pinnedNotes.length > 0 && (
          <section className="mt-7">
            <div className="mb-3">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#d8b15d]">Pinned</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Keep these close</h2>
            </div>
            <div className="space-y-3">
              {pinnedNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={onOpenNote} onTogglePin={onTogglePin} />)}
            </div>
          </section>
        )}

        <section className="mt-7">
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#d8b15d]">{showSections ? 'Recent' : 'Results'}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {showSections ? 'Latest notes' : `${notes.length} matching note${notes.length === 1 ? '' : 's'}`}
            </h2>
            {activeFilter !== 'all' && (
              <p className="mt-1 text-sm text-white/46">Filtered by {getCategoryLabel(activeFilter === 'unassigned' ? '' : activeFilter.replace('category:', '').replace('pinned', 'Pinned').replace('all', 'All'))}</p>
            )}
          </div>
          <div className="space-y-3">
            {recentNotes.map((note) => <NoteCard key={note.id} note={note} onOpen={onOpenNote} onTogglePin={onTogglePin} />)}
            {notes.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-white/12 bg-white/[0.02] px-5 py-8 text-center">
                <h3 className="text-lg font-semibold text-white">Nothing here yet</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">Try another search, switch filters, or create a quick note to start your workspace.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="pointer-events-auto mx-auto flex max-w-[17rem] items-center justify-between rounded-full border border-white/8 bg-[#171717]/92 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <button type="button" onClick={onNavigateHome} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] text-zinc-100">
            <Home size={20} />
          </button>
          <button type="button" onClick={() => onCreate()} className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f1cf82] text-[#17130b] shadow-lg shadow-[#8d6f2c]/30">
            <Plus size={26} />
          </button>
          <div className="flex min-w-12 items-center justify-center rounded-full bg-white/[0.05] px-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/68">
            notes
          </div>
        </div>
      </div>
    </>
  );
}
