import { Search } from 'lucide-react';

interface ArtifactSearchBarProps {
  onChange: (value: string) => void;
  onSubmit: () => void;
  query: string;
}

export function ArtifactSearchBar({ onChange, onSubmit, query }: ArtifactSearchBarProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[#1f2c37] px-4 py-3 text-xs text-zinc-400">
      <Search size={14} className="text-zinc-500" />
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Search this artifact"
        className="flex-1 rounded-lg border border-[#243443] bg-[#0f1820] px-3 py-2 text-sm text-zinc-100 outline-none"
      />
      <button type="button" onClick={onSubmit} className="rounded-lg border border-[#35536e] px-3 py-2 text-xs text-[#d9e9f5] transition hover:text-white">
        Go
      </button>
    </div>
  );
}
