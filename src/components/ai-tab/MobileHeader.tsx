import { PanelLeft, Plus } from 'lucide-react';

interface MobileHeaderProps {
  sidebarOpen: boolean;
  onNewChat: () => void;
  onToggleSidebar: () => void;
}

export function MobileHeader({ onNewChat, onToggleSidebar }: MobileHeaderProps) {
  return (
    <div className="absolute left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-800 bg-[#121210] px-4 text-[#efeae4] md:hidden">
      <button type="button" onClick={onToggleSidebar} className="rounded px-2 py-1 hover:bg-[#20201e]">
        <PanelLeft size={20} />
      </button>
      <span className="flex items-center gap-1 font-serif text-xl font-medium tracking-tight text-[#efeae4]/95">
        <span className="inline-block h-4 w-4 rounded-full bg-[#e2875e]/20 text-center text-xs font-bold leading-none text-[#e2875e]">*</span>
        Ollama
      </span>
      <button type="button" onClick={onNewChat} className="rounded-full p-1.5 hover:bg-[#20201e]">
        <Plus size={20} />
      </button>
    </div>
  );
}
