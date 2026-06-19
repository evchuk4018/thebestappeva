import { Sliders, Trash2 } from 'lucide-react';
import { Chat } from './types';

interface SidebarChatsPanelProps {
  chats: Chat[];
  isMobile: boolean;
  selectedChatId: string | null;
  status?: 'loading' | 'ready' | 'error';
  errorMessage?: string | null;
  searchActive?: boolean;
  searchQuery?: string;
  totalChats?: number;
  onClose: () => void;
  onDeleteChat: (chatId: string, event: React.MouseEvent) => void;
  onSelectChat: (chatId: string) => void;
}

export function SidebarChatsPanel({
  chats,
  isMobile,
  selectedChatId,
  status = 'ready',
  errorMessage,
  searchActive = false,
  searchQuery = '',
  totalChats,
  onClose,
  onDeleteChat,
  onSelectChat,
}: SidebarChatsPanelProps) {
  const trimmedQuery = searchQuery.trim();
  const showLoading = status === 'loading';
  const showError = status === 'error';
  const showEmpty = !showLoading && !showError && chats.length === 0;

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col px-2 pb-4">
      <div className="mb-1.5 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        <span>{searchActive ? 'Results' : 'Recents'}</span>
        <button type="button" className="rounded p-0.5 text-zinc-600 hover:text-zinc-400">
          <Sliders size={11} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
        {showLoading && (
          <div className="px-3 py-4 text-xs italic text-zinc-500">Loading chats…</div>
        )}
        {showError && (
          <div className="px-3 py-4 text-xs text-red-400">
            {errorMessage || 'Unable to load chats.'}
          </div>
        )}
        {!showLoading && !showError && chats.map((chat) => {
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
        {showEmpty && searchActive && trimmedQuery && (
          <div className="px-3 py-4 text-xs italic text-zinc-500">
            No chats found for “{trimmedQuery}”.
          </div>
        )}
        {showEmpty && (!searchActive || !trimmedQuery) && (
          <div className="px-3 py-4 text-xs italic text-zinc-600">
            {totalChats && totalChats > 0 ? 'No matching chats.' : 'No chats yet'}
          </div>
        )}
      </div>
    </div>
  );
}
