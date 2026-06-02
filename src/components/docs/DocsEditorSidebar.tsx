import { ListTree, Menu, Plus } from 'lucide-react';
import { DocTabRecord } from './docs-types';

interface DocsEditorSidebarProps {
  activeTabId: string;
  tabs: DocTabRecord[];
  onAddTab: () => void;
  onSelectTab: (tabId: string) => void;
}

export function DocsEditorSidebar({ activeTabId, tabs, onAddTab, onSelectTab }: DocsEditorSidebarProps) {
  return (
    <aside className="flex w-[232px] flex-col border-r border-[#1f242d] bg-[#090b10]">
      <div className="flex items-center justify-between px-4 py-4 text-zinc-400">
        <button className="rounded-md p-2 transition hover:bg-white/5 hover:text-white"><Menu size={18} /></button>
        <button onClick={onAddTab} className="rounded-md p-2 transition hover:bg-white/5 hover:text-white"><Plus size={18} /></button>
      </div>
      <div className="px-3 pb-3">
        <p className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-zinc-500"><ListTree size={13} /> Document tabs</p>
        <div className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition ${tab.id === activeTabId ? 'bg-[#121722] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
            >
              <span className="truncate">{tab.title}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
