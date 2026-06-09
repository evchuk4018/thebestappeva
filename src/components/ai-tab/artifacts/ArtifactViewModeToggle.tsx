import { Code2, Eye } from 'lucide-react';

export type ArtifactViewMode = 'preview' | 'code';

interface ArtifactViewModeToggleProps {
  mode: ArtifactViewMode;
  onChange: (mode: ArtifactViewMode) => void;
}

function buttonClass(isActive: boolean) {
  return `rounded-lg border px-3 py-2 transition ${
    isActive
      ? 'border-[#40607d] bg-[#13202b] text-white'
      : 'border-[#243443] bg-[#0f1820] text-zinc-300 hover:text-white'
  }`;
}

export function ArtifactViewModeToggle({ mode, onChange }: ArtifactViewModeToggleProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[#1f2c37] px-4 py-3 text-xs text-zinc-400">
      <button type="button" onClick={() => onChange('preview')} className={buttonClass(mode === 'preview')}>
        <Eye size={15} />
      </button>
      <button type="button" onClick={() => onChange('code')} className={buttonClass(mode === 'code')}>
        <Code2 size={15} />
      </button>
      <span className="ml-2 uppercase tracking-[0.18em] text-zinc-500">{mode === 'preview' ? 'Final copy' : 'Editor'}</span>
    </div>
  );
}
