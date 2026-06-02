import { History, Share2, Star, StarOff } from 'lucide-react';
import { DocRecord } from './docs-types';

interface DocsEditorHeaderProps {
  doc: DocRecord;
  saveState: 'idle' | 'saving' | 'saved';
  onBack: () => void;
  onToggleStar: () => void;
  onTitleChange: (title: string) => void;
}

export function DocsEditorHeader({ doc, saveState, onBack, onToggleStar, onTitleChange }: DocsEditorHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#1f242d] bg-[#11141b] px-5 py-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-xl font-black tracking-tight text-white transition hover:text-red-300">Docs</button>
        <div className="h-7 w-px bg-[#2d3340]" />
        <input
          value={doc.title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-[340px] rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-white outline-none transition hover:border-[#2d3340] focus:border-[#2563eb]"
        />
        <button onClick={onToggleStar} className="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white">
          {doc.starred ? <Star size={16} className="fill-amber-300 text-amber-300" /> : <StarOff size={16} />}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[#0a0d11] px-4 py-2 text-xs text-zinc-400">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved to browser' : 'Editing'}
        </div>
        <button className="rounded-full border border-[#2d3340] p-2 text-zinc-300 transition hover:border-[#3f4656] hover:text-white">
          <History size={16} />
        </button>
        <button className="rounded-full bg-[#2563eb] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8]">
          <Share2 size={15} className="mr-2 inline-block" />
          Share
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">ER</div>
      </div>
    </div>
  );
}
