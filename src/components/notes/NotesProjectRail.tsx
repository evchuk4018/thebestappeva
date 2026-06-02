import { FolderOpenDot, Plus } from 'lucide-react';
import { NoteFilter } from './notes-types';
import { buildCategoryFilter } from './notes-utils';

interface ProjectSummary {
  category: string;
  noteCount: number;
}

interface NotesProjectRailProps {
  activeFilter: NoteFilter;
  projects: ProjectSummary[];
  onCreate: (category: string) => void;
  onSelect: (filter: NoteFilter) => void;
}

export function NotesProjectRail({ activeFilter, projects, onCreate, onSelect }: NotesProjectRailProps) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[#d8b15d]">Projects</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Jump into a focus area</h2>
        </div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {projects.map((project) => {
          const filter = buildCategoryFilter(project.category);
          const active = activeFilter === filter;
          return (
            <div
              key={project.category}
              className={`min-w-[220px] rounded-[24px] border p-4 ${active ? 'border-[#d8b15d]/55 bg-[#1a1710]' : 'border-white/8 bg-[#141414]'}`}
            >
              <button type="button" onClick={() => onSelect(filter)} className="w-full text-left">
                <div className="flex items-center gap-2 text-[#f1d28a]">
                  <FolderOpenDot size={16} />
                  <span className="text-sm font-medium">{project.category}</span>
                </div>
                <p className="mt-3 text-sm text-white/62">{project.noteCount} linked note{project.noteCount === 1 ? '' : 's'}</p>
              </button>
              <button
                type="button"
                onClick={() => onCreate(project.category)}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#d8b15d]/35 bg-[#d8b15d]/12 px-3 py-2 text-xs font-medium text-[#f4d793] transition hover:border-[#d8b15d]/65"
              >
                <Plus size={14} />
                New note
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
