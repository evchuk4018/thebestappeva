import { ArrowLeft, Pencil, Pin, Trash2 } from 'lucide-react';
import { NoteSearchIndexEntry } from './notes-types';
import { formatNoteDate, unassignedCategoryLabel } from './notes-utils';

interface NotesDetailScreenProps {
  availableCategories: string[];
  note: NoteSearchIndexEntry | null;
  onBack: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRelink: (category: string) => void;
  onTogglePin: () => void;
}

export function NotesDetailScreen({
  availableCategories,
  note,
  onBack,
  onDelete,
  onEdit,
  onRelink,
  onTogglePin,
}: NotesDetailScreenProps) {
  if (!note) return null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-white/6 px-5 pb-5 pt-6">
        <button type="button" onClick={onBack} className="rounded-full border border-white/8 p-3 text-white/72 transition hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onTogglePin} className="rounded-full border border-white/8 p-3 text-[#f4d793] transition hover:border-[#d8b15d]/45">
            <Pin size={16} fill={note.pinned ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={onEdit} className="rounded-full border border-white/8 p-3 text-white/72 transition hover:text-white">
            <Pencil size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        <p className="text-[11px] uppercase tracking-[0.32em] text-[#d8b15d]">{note.category || unassignedCategoryLabel}</p>
        <h1 className="mt-3 text-[1.9rem] font-semibold leading-tight text-white">{note.title}</h1>
        <p className="mt-3 text-sm text-white/42">Updated {formatNoteDate(note.updatedAt)}</p>
        <article className="mt-6 whitespace-pre-wrap rounded-[28px] border border-white/8 bg-[#151515] px-4 py-5 text-sm leading-7 text-white/82">
          {note.body || 'No content yet.'}
        </article>
        {note.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {note.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-white/8 px-3 py-1 text-[11px] text-white/56">
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-6 rounded-[24px] border border-white/8 bg-[#151515] p-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#d8b15d]">Project link</p>
          <select
            value={note.category}
            onChange={(event) => onRelink(event.target.value)}
            className="mt-3 w-full rounded-[18px] border border-white/8 bg-[#101010] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="">{unassignedCategoryLabel}</option>
            {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
      </main>

      <footer className="border-t border-white/6 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-full border border-red-400/25 px-4 py-3 text-sm text-red-200">
          <Trash2 size={15} />
          Delete note
        </button>
      </footer>
    </div>
  );
}
