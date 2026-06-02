import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActiveChatView } from './ai-tab/ActiveChatView';
import { ChatComposer } from './ai-tab/ChatComposer';
import { createInitialChats, modelOptions } from './ai-tab/data';
import { EmptyState } from './ai-tab/EmptyState';
import { appendMessage, buildAiResponse, createNewChat, getSuggestionPrompt } from './ai-tab/helpers';
import { MobileHeader } from './ai-tab/MobileHeader';
import { Sidebar } from './ai-tab/Sidebar';
import { Chat } from './ai-tab/types';
import { useResponsiveSidebar } from './ai-tab/useResponsiveSidebar';

export default function AiTab() {
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState(modelOptions[0]);
  const [chats, setChats] = useState<Chat[]>(createInitialChats);

  useResponsiveSidebar({ setIsMobile, setSidebarOpen });

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chats, isTyping, selectedChatId]);

  const activeChat = chats.find((chat) => chat.id === selectedChatId) ?? null;

  const handleSuggestionClick = (label: string) => {
    setInputValue(getSuggestionPrompt(label));
  };

  const handleDeleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setChats((currentChats) => currentChats.filter((chat) => chat.id !== chatId));
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  };

  const handleNewChat = () => {
    setSelectedChatId(null);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const triggerAiReply = (chatId: string, messageText: string) => {
    setIsTyping(true);
    window.setTimeout(() => {
      const assistantMessage = { role: 'assistant' as const, content: buildAiResponse(messageText) };
      setChats((currentChats) => currentChats.map((chat) => (chat.id === chatId ? appendMessage(chat, assistantMessage) : chat)));
      setIsTyping(false);
    }, 1200);
  };

  const handleSend = () => {
    if (!inputValue.trim() || isTyping) {
      return;
    }

    const userMessage = inputValue;
    setInputValue('');

    if (selectedChatId === null) {
      const newChat = createNewChat(userMessage);
      setChats((currentChats) => [newChat, ...currentChats]);
      setSelectedChatId(newChat.id);
      triggerAiReply(newChat.id, userMessage);
      return;
    }

    setChats((currentChats) => currentChats.map((chat) => (
      chat.id === selectedChatId ? appendMessage(chat, { role: 'user', content: userMessage }) : chat
    )));
    triggerAiReply(selectedChatId, userMessage);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#1b1b19] font-sans text-[#efeae4]">
      <MobileHeader sidebarOpen={sidebarOpen} onNewChat={handleNewChat} onToggleSidebar={() => setSidebarOpen((open) => !open)} />

      <AnimatePresence>
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-black md:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar
        chats={chats}
        isMobile={isMobile}
        selectedChatId={selectedChatId}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onDeleteChat={handleDeleteChat}
        onNavigateHome={() => navigate('/')}
        onNewChat={handleNewChat}
        onSelectChat={setSelectedChatId}
      />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {!sidebarOpen && !isMobile && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 top-4 z-20 rounded-xl border border-[#2c2c28] bg-[#20201e] p-2 text-zinc-300 shadow-xl duration-200 hover:text-white"
          >
            <PanelLeft size={18} />
          </button>
        )}

        <div className="flex h-16 select-none items-center justify-center pt-3">
          <div className="inline-flex items-center gap-1 rounded-full border border-[#2f2f2b]/45 bg-[#121210]/40 px-3 py-1.5 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
            <span>Free plan</span>
            <span className="px-1 text-zinc-600">.</span>
            <button type="button" className="font-medium text-[#e2875e] hover:underline">Upgrade</button>
          </div>
        </div>

        <div ref={chatContainerRef} className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-32 pt-2 md:px-8">
          {activeChat ? (
            <ActiveChatView activeChat={activeChat} currentModel={currentModel} isTyping={isTyping} />
          ) : (
            <EmptyState
              currentModel={currentModel}
              inputValue={inputValue}
              isModelDropdownOpen={modelDropdownOpen}
              isTyping={isTyping}
              onInputChange={setInputValue}
              onKeyDown={handleKeyDown}
              onSelectModel={(model) => {
                setCurrentModel(model);
                setModelDropdownOpen(false);
              }}
              onSelectSuggestion={handleSuggestionClick}
              onSend={handleSend}
              onToggleModelDropdown={() => setModelDropdownOpen((open) => !open)}
            />
          )}
        </div>

        {activeChat && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center border-t border-[#242422]/60 bg-[#1b1b19] px-4 py-4 md:px-8">
            <div className="w-full max-w-xl md:max-w-2xl">
              <ChatComposer
                compact
                currentModel={currentModel}
                inputValue={inputValue}
                isModelDropdownOpen={false}
                isTyping={isTyping}
                onInputChange={setInputValue}
                onKeyDown={handleKeyDown}
                onSelectModel={setCurrentModel}
                onSend={handleSend}
                onToggleModelDropdown={() => setModelDropdownOpen((open) => !open)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
