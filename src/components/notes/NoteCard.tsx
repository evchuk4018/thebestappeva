import { Pin, PinOff } from 'lucide-react';
import { NoteSearchIndexEntry } from './notes-types';
import { formatNoteDate, getCategoryLabel } from './notes-utils';

interface NoteCardProps {
  note: NoteSearchIndexEntry;
  onOpen: (noteId: string) => void;
  onTogglePin: (noteId: string) => void;
}

export function NoteCard({ note, onOpen, onTogglePin }: NoteCardProps) {
  return (
    <article className="rounded-[24px] border border-white/8 bg-[#151515] p-4 shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition hover:border-[#d8b15d]/40">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onOpen(note.id)} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] text-[#d8b15d]">
            <span>{getCategoryLabel(note.category)}</span>
            <span className="text-white/15">•</span>
            <span className="text-white/45">{formatNoteDate(note.updatedAt)}</span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-white">{note.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/66">{note.preview || 'No body yet.'}</p>
        </button>
        <button
          type="button"
          onClick={() => onTogglePin(note.id)}
          className="rounded-full border border-white/8 bg-white/[0.04] p-2 text-[#f0d288] transition hover:border-[#d8b15d]/40 hover:text-[#f8dd9d]"
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        >
          {note.pinned ? <Pin size={15} fill="currentColor" /> : <PinOff size={15} />}
        </button>
      </div>
      {note.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {note.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/8 px-2.5 py-1 text-[11px] text-white/56">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
