import { Sliders, Trash2 } from 'lucide-react';
import { Chat } from './types';

interface SidebarChatsPanelProps {
  chats: Chat[];
  isMobile: boolean;
  selectedChatId: string | null;
  onClose: () => void;
  onDeleteChat: (chatId: string, event: React.MouseEvent) => void;
  onSelectChat: (chatId: string) => void;
}

export function SidebarChatsPanel({
  chats,
  isMobile,
  selectedChatId,
  onClose,
  onDeleteChat,
  onSelectChat,
}: SidebarChatsPanelProps) {
  return (
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
                className="absolute right-1.5 top-1/2 rounded p-1 text-zinc-500 opacity-0 duration-100 hover:bg-[#20201e] hover:text-red-400 group-hover:opacity-100"
                style={{ transform: 'translateY(-50%)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {chats.length === 0 && <div className="px-3 py-4 text-xs italic text-zinc-600">No chats yet</div>}
      </div>
    </div>
  );
}
