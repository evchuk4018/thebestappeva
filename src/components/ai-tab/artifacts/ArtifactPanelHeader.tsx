import { ExternalLink, X } from 'lucide-react';
import type { ArtifactRecord, ArtifactSummary } from '../../../lib/ai-artifacts-storage';

interface ArtifactPanelHeaderProps {
  activeArtifact: ArtifactRecord;
  artifacts: ArtifactSummary[];
  includedArtifactIds: string[];
  onClose: () => void;
  onExport: () => Promise<void>;
  onOpenArtifact: (artifactId: string) => void;
  onSetIncluded: (included: boolean) => void;
}

export function ArtifactPanelHeader({
  activeArtifact,
  artifacts,
  includedArtifactIds,
  onClose,
  onExport,
  onOpenArtifact,
  onSetIncluded,
}: ArtifactPanelHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[#1f2c37] px-4 py-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#8db4d0]">{activeArtifact.type}</p>
          <h3 className="truncate font-semibold text-white">{activeArtifact.title}</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-[#2b3c4d] p-2 text-zinc-400 transition hover:text-white">
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-[#1f2c37] px-4 py-3 text-xs text-zinc-400">
        <select value={activeArtifact.artifactId} onChange={(event) => onOpenArtifact(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-[#243443] bg-[#0f1820] px-3 py-2 text-zinc-200">
          {artifacts.map((artifact) => (
            <option key={artifact.artifactId} value={artifact.artifactId}>
              {artifact.title}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-[#243443] px-3 py-2">
          <input type="checkbox" checked={includedArtifactIds.includes(activeArtifact.artifactId)} onChange={(event) => onSetIncluded(event.target.checked)} />
          <span>Include</span>
        </label>
        <button type="button" onClick={() => void onExport()} className="flex items-center gap-1 rounded-lg border border-[#35536e] px-3 py-2 text-[#d9e9f5] transition hover:text-white">
          <ExternalLink size={13} />
          <span>Export</span>
        </button>
      </div>
    </>
  );
}
