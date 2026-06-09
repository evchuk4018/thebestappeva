import { FileText } from 'lucide-react';
import { ArtifactCardSummary } from '../types';

interface ArtifactCardsProps {
  cards: ArtifactCardSummary[];
  onOpen: (artifactId: string) => void;
}

export function ArtifactCards({ cards, onOpen }: ArtifactCardsProps) {
  if (!cards.length) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {cards.map((card) => (
        <div key={card.artifactId} className="rounded-2xl border border-[#2c3a46] bg-[#11161d] px-3 py-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#8db4d0]">
                <FileText size={12} />
                <span>{card.type}</span>
              </div>
              <p className="mt-1 truncate font-medium text-white">{card.title}</p>
              {card.preview && <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{card.preview}</p>}
            </div>
            <button
              type="button"
              onClick={() => onOpen(card.artifactId)}
              className="rounded-full border border-[#35536e] px-3 py-1 text-xs font-medium text-[#d9e9f5] transition hover:border-[#5b7e9f] hover:text-white"
            >
              Open
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
