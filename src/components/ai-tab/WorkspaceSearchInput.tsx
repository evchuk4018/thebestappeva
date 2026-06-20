import { Search, X } from 'lucide-react';

interface WorkspaceSearchInputProps {
  onChange: (value: string) => void;
  placeholder: string;
  query: string;
}

export function WorkspaceSearchInput({ onChange, placeholder, query }: WorkspaceSearchInputProps) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-[#2f2f2b] bg-[#171715] px-3 py-2.5">
      <Search size={15} className="shrink-0 text-zinc-500" />
      <input
        type="text"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-[#efeae4] outline-none placeholder:text-zinc-600"
      />
      {query && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          title="Clear search"
          className="rounded p-0.5 text-zinc-500 transition hover:bg-[#20201e] hover:text-zinc-200"
        >
          <X size={13} />
        </button>
      )}
    </label>
  );
}
