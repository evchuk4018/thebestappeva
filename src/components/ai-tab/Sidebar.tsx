import { ChevronUp, Download, MessageSquare, PanelLeftClose, Plus, Search, Wrench } from 'lucide-react';
import { Chat } from './types';
import { SidebarChatsPanel } from './SidebarChatsPanel';
import { ToolsPanel } from './ToolsPanel';
import { ToolDefinition } from './tools/types';

type SidebarPanel = 'chats' | 'tools';

interface SidebarTool extends ToolDefinition {
  enabled: boolean;
}

interface SidebarProps {
  activePanel: SidebarPanel;
  chats: Chat[];
  isMobile: boolean;
  selectedChatId: string | null;
  sidebarOpen: boolean;
  tools: SidebarTool[];
  onClose: () => void;
  onDeleteChat: (chatId: string, event: React.MouseEvent) => void;
  onNavigateHome: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onSelectPanel: (panel: SidebarPanel) => void;
  onToggleTool: (toolId: string, enabled: boolean) => void;
}

const panelItems = [
  { icon: MessageSquare, label: 'Chats', value: 'chats' },
  { icon: Wrench, label: 'Tools', value: 'tools' },
] as const;

export function Sidebar({
  activePanel,
  chats,
  isMobile,
  selectedChatId,
  sidebarOpen,
  tools,
  onClose,
  onDeleteChat,
  onNavigateHome,
  onNewChat,
  onSelectChat,
  onSelectPanel,
  onToggleTool,
}: SidebarProps) {
  return (
    <div
      className={`fixed bottom-0 left-0 top-0 z-40 flex h-full w-72 transform flex-col justify-between border-r border-[#242422]/60 bg-[#121210] transition-transform duration-300 md:relative md:w-64 lg:w-72 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:absolute md:w-0 md:-translate-x-full md:overflow-hidden md:opacity-0'
      }`}
    >
      <div className="flex h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="font-serif text-2xl font-medium tracking-wide text-[#efeae4]">Ollama</span>
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
            onClick={() => {
              onSelectPanel('chats');
              onNewChat();
            }}
            className="flex w-full items-center justify-between rounded-xl border border-[#2f2f2b] px-4 py-2.5 text-left text-sm font-medium text-[#efeae4] duration-150 hover:bg-[#1a1a18]"
          >
            <span className="flex items-center gap-2">
              <Plus size={16} className="text-zinc-400" />
              <span>New chat</span>
            </span>
            <span className="rounded border border-[#292926] bg-[#1d1d1b] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">K</span>
          </button>
        </div>

        <div className="mt-3 px-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Workspace</div>
          <div className="grid grid-cols-2 gap-2">
            {panelItems.map(({ icon: Icon, label, value }) => {
              const isActive = activePanel === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSelectPanel(value)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                    isActive ? 'bg-[#1f262f] text-[#efeae4]' : 'bg-[#171715] text-zinc-400 hover:bg-[#1a1a18] hover:text-zinc-200'
                  }`}
                >
                  <Icon size={15} className={isActive ? 'text-[#8db4d0]' : 'text-zinc-500'} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activePanel === 'chats' ? (
          <SidebarChatsPanel
            chats={chats}
            isMobile={isMobile}
            selectedChatId={selectedChatId}
            onClose={onClose}
            onDeleteChat={onDeleteChat}
            onSelectChat={onSelectChat}
          />
        ) : (
          <ToolsPanel tools={tools} onToggleTool={onToggleTool} />
        )}
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
              <span className="text-[10px] leading-none text-zinc-500">Local runtime</span>
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
