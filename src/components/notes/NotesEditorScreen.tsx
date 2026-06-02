import { ArrowLeft, Pin, Trash2 } from 'lucide-react';
import { NoteDraft } from './notes-types';
import { unassignedCategoryLabel } from './notes-utils';

interface NotesEditorScreenProps {
  availableCategories: string[];
  draft: NoteDraft;
  editing: boolean;
  error: string;
  onBack: () => void;
  onDelete?: () => void;
  onDraftChange: (updater: (draft: NoteDraft) => NoteDraft) => void;
  onSave: () => void;
}

export function NotesEditorScreen({
  availableCategories,
  draft,
  editing,
  error,
  onBack,
  onDelete,
  onDraftChange,
  onSave,
}: NotesEditorScreenProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-white/6 px-5 pb-5 pt-6">
        <button type="button" onClick={onBack} className="rounded-full border border-white/8 p-3 text-white/72 transition hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.32em] text-[#d8b15d]">{editing ? 'Edit note' : 'New note'}</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{editing ? 'Shape the idea' : 'Capture it fast'}</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          <input
            value={draft.title}
            onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, title: event.target.value }))}
            placeholder="Name your note"
            className="w-full rounded-[22px] border border-white/8 bg-[#151515] px-4 py-4 text-lg text-white outline-none placeholder:text-white/25"
          />
          <textarea
            value={draft.body}
            onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, body: event.target.value }))}
            placeholder="Start writing..."
            className="min-h-[280px] w-full rounded-[28px] border border-white/8 bg-[#151515] px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/25"
          />
          <input
            value={draft.tagsInput}
            onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, tagsInput: event.target.value }))}
            placeholder="Tags, comma separated"
            className="w-full rounded-[22px] border border-white/8 bg-[#151515] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25"
          />
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <select
              value={draft.category}
              onChange={(event) => onDraftChange((currentDraft) => ({ ...currentDraft, category: event.target.value }))}
              className="rounded-[22px] border border-white/8 bg-[#151515] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">{unassignedCategoryLabel}</option>
              {availableCategories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <button
              type="button"
              onClick={() => onDraftChange((currentDraft) => ({ ...currentDraft, pinned: !currentDraft.pinned }))}
              className={`inline-flex items-center justify-center gap-2 rounded-[22px] border px-4 py-3 text-sm transition ${draft.pinned ? 'border-[#d8b15d]/55 bg-[#d8b15d]/12 text-[#f4d793]' : 'border-white/8 bg-[#151515] text-white/66'}`}
            >
              <Pin size={15} fill={draft.pinned ? 'currentColor' : 'none'} />
              {draft.pinned ? 'Pinned' : 'Pin note'}
            </button>
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-3 border-t border-white/6 px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
        <button
          type="button"
          onClick={onDelete}
          disabled={!editing || !onDelete}
          className="inline-flex items-center gap-2 rounded-full border border-white/8 px-4 py-3 text-sm text-white/56 disabled:opacity-35"
        >
          <Trash2 size={15} />
          Delete
        </button>
        <button type="button" onClick={onSave} className="rounded-full bg-[#f1cf82] px-5 py-3 text-sm font-medium text-[#17130b]">
          Save note
        </button>
      </footer>
    </div>
  );
}
