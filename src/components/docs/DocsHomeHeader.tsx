import { ChangeEventHandler } from 'react';
import { ArrowLeft, FileUp, Search, Trash2 } from 'lucide-react';
import { DocPreferences } from './docs-types';

interface DocsHomeHeaderProps {
  busy: boolean;
  error: string | null;
  preferences: DocPreferences;
  query: string;
  showTrash: boolean;
  onBack: () => void;
  onImport: ChangeEventHandler<HTMLInputElement>;
  onPreferencesChange: (preferences: DocPreferences) => void;
  onQueryChange: (value: string) => void;
  onToggleTrash: () => void;
}

export function DocsHomeHeader({
  busy,
  error,
  preferences,
  query,
  showTrash,
  onBack,
  onImport,
  onPreferencesChange,
  onQueryChange,
  onToggleTrash,
}: DocsHomeHeaderProps) {
  return (
    <header className="rounded-[28px] border border-zinc-800 bg-[#101216] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="rounded-full border border-zinc-700 p-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-red-400">Docs</p>
            <h1 className="text-3xl font-semibold text-white">Files, templates, and local history</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-zinc-700 px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white">
            <FileUp size={16} />
            <span>Import .docx</span>
            <input type="file" accept=".docx" className="hidden" onChange={onImport} />
          </label>
          <button onClick={onToggleTrash} className={`rounded-full border px-4 py-3 text-sm transition ${showTrash ? 'border-red-500 bg-red-500/15 text-red-200' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white'}`}>
            <Trash2 size={16} className="mr-2 inline-block" />
            {showTrash ? 'Showing trash' : 'View trash'}
          </button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[320px] flex-1 items-center gap-3 rounded-full border border-zinc-800 bg-[#090b0f] px-4 py-3 text-zinc-300">
          <Search size={18} className="text-zinc-500" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by file title or content"
            className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
          />
        </label>
        <select
          value={preferences.sort}
          onChange={(event) => onPreferencesChange({ ...preferences, sort: event.target.value as DocPreferences['sort'] })}
          className="rounded-full border border-zinc-700 bg-[#090b0f] px-4 py-3 text-sm text-zinc-200 outline-none"
        >
          <option value="lastOpenedAt">Sort: Last opened</option>
          <option value="updatedAt">Sort: Last modified</option>
          <option value="title">Sort: Title</option>
        </select>
        <div className="rounded-full border border-zinc-800 bg-[#090b0f] px-4 py-3 text-sm text-zinc-500">
          {busy ? 'Working...' : error ? error : 'Stored in the local Postgres workspace'}
        </div>
      </div>
    </header>
  );
}
