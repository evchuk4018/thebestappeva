import {
  Briefcase,
  ChevronUp,
  Download,
  Layers,
  LayoutGrid,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Search,
  Sliders,
  Terminal,
  Trash2,
} from 'lucide-react';
import { Chat } from './types';

interface SidebarProps {
  chats: Chat[];
  isMobile: boolean;
  selectedChatId: string | null;
  sidebarOpen: boolean;
  onClose: () => void;
  onDeleteChat: (chatId: string, event: React.MouseEvent) => void;
  onNavigateHome: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
}

export function Sidebar({
  chats,
  isMobile,
  selectedChatId,
  sidebarOpen,
  onClose,
  onDeleteChat,
  onNavigateHome,
  onNewChat,
  onSelectChat,
}: SidebarProps) {
  const menuItems = [
    { icon: MessageSquare, label: 'Chats' },
    { icon: Briefcase, label: 'Projects' },
    { icon: Layers, label: 'Artifacts' },
    { icon: Sliders, label: 'Customize' },
  ];
  const productItems = [
    { icon: LayoutGrid, label: 'Cowork' },
    { icon: Terminal, label: 'Code' },
  ];

  return (
    <div
      className={`fixed bottom-0 left-0 top-0 z-40 flex h-full w-72 transform flex-col justify-between border-r border-[#242422]/60 bg-[#121210] transition-transform duration-300 md:relative md:w-64 lg:w-72 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:absolute md:w-0 md:-translate-x-full md:overflow-hidden md:opacity-0'
      }`}
    >
      <div className="flex h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="font-serif text-2xl font-medium tracking-wide text-[#efeae4]">Claude</span>
          <div className="flex items-center gap-1.5">
            <button type="button" className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#20201e] hover:text-zinc-200">
              <Search size={16} />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-[#20201e] hover:text-zinc-200">
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1 px-3 py-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-between rounded-xl border border-[#2f2f2b] px-4 py-2.5 text-left text-sm font-medium text-[#efeae4] duration-150 hover:bg-[#1a1a18]"
          >
            <span className="flex items-center gap-2">
              <Plus size={16} className="text-zinc-400" />
              <span>New chat</span>
            </span>
            <span className="rounded border border-[#292926] bg-[#1d1d1b] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">K</span>
          </button>
        </div>

        <div className="flex flex-col gap-0.5 px-2 py-1.5 text-sm font-normal text-zinc-400">
          {menuItems.map(({ icon: Icon, label }) => (
            <button key={label} type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#1a1a18]">
              <Icon size={16} className="text-zinc-500" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 px-2">
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Products</div>
          <div className="flex flex-col gap-0.5 text-sm text-zinc-400">
            {productItems.map(({ icon: Icon, label }) => (
              <button key={label} type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-[#1a1a18]">
                <Icon size={16} className="text-zinc-600" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-1 flex-col px-2 pb-4">
          <div className="mb-1.5 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
            <span>Recents</span>
            <button type="button" className="rounded p-0.5 text-zinc-600 hover:text-zinc-400">
              <Sliders size={11} />
            </button>
          </div>
          <div className="flex max-h-[320px] flex-col gap-0.5 overflow-y-auto pr-1">
            {chats.map((chat) => {
              const isActive = chat.id === selectedChatId;
              return (
                <div
                  key={chat.id}
                  onClick={() => {
                    onSelectChat(chat.id);
                    if (isMobile) {
                      onClose();
                    }
                  }}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-xs duration-150 ${
                    isActive ? 'bg-[#272724] font-medium text-[#efeae4]' : 'text-zinc-400 hover:bg-[#1a1a18] hover:text-[#efeae4]'
                  }`}
                >
                  <span className="w-full truncate pr-4">{chat.title}</span>
                  <button
                    type="button"
                    onClick={(event) => onDeleteChat(chat.id, event)}
                    className="absolute right-1.5 top-1/2 rounded p-1 text-zinc-500 opacity-0 duration-100 hover:bg-[#20201e] hover:text-red-400 group-hover:opacity-100 -translate-y-1/2"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {chats.length === 0 && <div className="px-3 py-4 text-xs italic text-zinc-600">No chats yet</div>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#242422]/60 bg-[#11110f] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onNavigateHome}
              title="Exit AI to Gym Lobby"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#efeae4]/10 bg-[#f4ebd0] text-xs font-bold text-[#121210] shadow-md transition-all hover:bg-[#e8deb8]"
            >
              JS
            </button>
            <div className="flex flex-col text-left">
              <span className="max-w-[124px] truncate text-xs font-semibold text-[#efeae4]">john skibidi</span>
              <span className="text-[10px] leading-none text-zinc-500">Free plan</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-500">
            <button type="button" className="rounded p-1 hover:bg-[#1a1a18] hover:text-[#efeae4]">
              <Download size={14} />
            </button>
            <button type="button" className="rounded p-1 hover:bg-[#1a1a18] hover:text-[#efeae4]">
              <ChevronUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
