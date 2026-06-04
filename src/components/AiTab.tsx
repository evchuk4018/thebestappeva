import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActiveChatView } from './ai-tab/ActiveChatView';
import { AddModelsModal } from './ai-tab/AddModelsModal';
import { AiStatusBanner } from './ai-tab/AiStatusBanner';
import { ChatComposer } from './ai-tab/ChatComposer';
import { EmptyState } from './ai-tab/EmptyState';
import { getSuggestionPrompt } from './ai-tab/helpers';
import { MobileHeader } from './ai-tab/MobileHeader';
import { pullModel } from './ai-tab/ollama-client';
import { RuntimePill } from './ai-tab/RuntimePill';
import { Sidebar } from './ai-tab/Sidebar';
import { PullProgress } from './ai-tab/types';
import { useOllamaChat } from './ai-tab/useOllamaChat';
import { useResponsiveSidebar } from './ai-tab/useResponsiveSidebar';

type SidebarPanel = 'chats' | 'tools';

export default function AiTab() {
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<SidebarPanel>('chats');
  const [addModelsOpen, setAddModelsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isPullingModel, setIsPullingModel] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const {
    availableModels,
    availability,
    chatMode,
    chats,
    currentModel,
    deleteChat,
    isTyping,
    lastError,
    refreshModels,
    selectChat,
    selectedChatId,
    sendMessage,
    toggleChatMode,
    setCurrentModel,
    stopMessage,
    toggleTool,
    tools,
  } = useOllamaChat();

  useResponsiveSidebar({ setIsMobile, setSidebarOpen });

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chats, isTyping, selectedChatId]);

  const activeChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const isModelLoading = availability === 'connecting';
  const openAddModels = () => {
    setModelDropdownOpen(false);
    setAddModelsOpen(true);
  };

  const handleSuggestionClick = (label: string) => {
    setInputValue(getSuggestionPrompt(label));
  };

  const handleDeleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteChat(chatId);
  };

  const handleNewChat = () => {
    setActivePanel('chats');
    selectChat(null);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSend = async () => {
    const nextMessage = inputValue.trim();
    if (!nextMessage || isTyping || !currentModel) {
      return;
    }

    setInputValue('');
    await sendMessage(nextMessage);
  };

  const handlePullModel = async (modelName: string) => {
    setIsPullingModel(true);
    setPullProgress({
      model: modelName,
      status: 'Preparing local download...',
      done: false,
    });

    try {
      await pullModel(modelName, (progress) => setPullProgress(progress));
      await refreshModels(modelName);
      setCurrentModel(modelName);
      setPullProgress({
        model: modelName,
        status: 'Model installed successfully.',
        done: true,
      });
    } catch (error) {
      setPullProgress({
        model: modelName,
        status: error instanceof Error ? error.message : 'Model download failed.',
        done: true,
        error: error instanceof Error ? error.message : 'Model download failed.',
      });
    } finally {
      setIsPullingModel(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
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
        activePanel={activePanel}
        chats={chats}
        isMobile={isMobile}
        selectedChatId={selectedChatId}
        sidebarOpen={sidebarOpen}
        tools={tools}
        onClose={() => setSidebarOpen(false)}
        onDeleteChat={handleDeleteChat}
        onNavigateHome={() => navigate('/')}
        onNewChat={handleNewChat}
        onSelectChat={(chatId) => {
          setActivePanel('chats');
          selectChat(chatId);
        }}
        onSelectPanel={setActivePanel}
        onToggleTool={toggleTool}
      />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
          <RuntimePill availability={availability} modelCount={availableModels.length} onOpenAddModels={openAddModels} />
        </div>

        <div ref={chatContainerRef} className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-32 pt-2 md:px-8">
          <AiStatusBanner availability={availability} lastError={lastError} onOpenAddModels={openAddModels} />

          {activeChat ? (
            <ActiveChatView activeChat={activeChat} currentModel={currentModel} isTyping={isTyping} />
          ) : (
            <EmptyState
              availability={availability}
              chatMode={chatMode}
              currentModel={currentModel}
              inputValue={inputValue}
              isModelDropdownOpen={modelDropdownOpen}
              isWorking={isTyping}
              isModelLoading={isModelLoading}
              models={availableModels}
              onAddModels={openAddModels}
              onInputChange={setInputValue}
              onKeyDown={handleKeyDown}
              onSelectModel={(model) => {
                setCurrentModel(model);
                setModelDropdownOpen(false);
              }}
              onSelectSuggestion={handleSuggestionClick}
              onSend={() => void handleSend()}
              onStop={stopMessage}
              onToggleMode={toggleChatMode}
              onToggleModelDropdown={() => setModelDropdownOpen((open) => !open)}
            />
          )}
        </div>

        {activeChat && (
          <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center border-t border-[#242422]/60 bg-[#1b1b19] px-4 py-4 md:px-8">
            <div className="w-full max-w-xl md:max-w-2xl">
              <ChatComposer
                availability={availability}
                chatMode={chatMode}
                compact
                currentModel={currentModel}
                inputValue={inputValue}
                isModelDropdownOpen={modelDropdownOpen}
                isWorking={isTyping}
                isModelLoading={isModelLoading}
                models={availableModels}
                onAddModels={openAddModels}
                onInputChange={setInputValue}
                onKeyDown={handleKeyDown}
                onSelectModel={(model) => {
                  setCurrentModel(model);
                  setModelDropdownOpen(false);
                }}
                onSend={() => void handleSend()}
                onStop={stopMessage}
                onToggleMode={toggleChatMode}
                onToggleModelDropdown={() => setModelDropdownOpen((open) => !open)}
              />
            </div>
          </div>
        )}
      </div>

      <AddModelsModal
        installedModelNames={availableModels.map((model) => model.name)}
        isOpen={addModelsOpen}
        isPulling={isPullingModel}
        pullProgress={pullProgress}
        onClose={() => setAddModelsOpen(false)}
        onPullModel={handlePullModel}
      />
    </div>
  );
}
