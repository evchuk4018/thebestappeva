import { NoteFilter, NoteFilterOption } from './notes-types';

interface NotesFilterChipsProps {
  activeFilter: NoteFilter;
  filters: NoteFilterOption[];
  onChange: (filter: NoteFilter) => void;
}

export function NotesFilterChips({ activeFilter, filters, onChange }: NotesFilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {filters.map((filter) => {
        const active = filter.id === activeFilter;
        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onChange(filter.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${active ? 'border-[#d8b15d] bg-[#d8b15d]/16 text-[#f6d78f]' : 'border-white/8 bg-white/[0.03] text-white/60 hover:border-white/16 hover:text-white/82'}`}
          >
            {filter.label} <span className="text-white/40">{filter.count}</span>
          </button>
        );
      })}
    </div>
  );
}
