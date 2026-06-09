import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PanelLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActiveChatView } from './ai-tab/ActiveChatView';
import { AiActiveComposer } from './ai-tab/AiActiveComposer';
import { AiTabOverlays } from './ai-tab/AiTabOverlays';
import { AiStatusBanner } from './ai-tab/AiStatusBanner';
import { AiWorkspaceLoadingState } from './ai-tab/AiWorkspaceLoadingState';
import { copyTextToClipboard } from './ai-tab/clipboard';
import { EmptyState } from './ai-tab/EmptyState';
import { getSuggestionPrompt } from './ai-tab/helpers';
import { MobileHeader } from './ai-tab/MobileHeader';
import { pullModel } from './ai-tab/ollama-client';
import { RuntimePill } from './ai-tab/RuntimePill';
import { Sidebar } from './ai-tab/Sidebar';
import { AiArtifactsWorkspace } from './ai-tab/AiArtifactsWorkspace';
import { PullProgress } from './ai-tab/types';
import { useAiAttachments } from './ai-tab/useAiAttachments';
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const {
    addFiles,
    clearReadyAttachments,
    isUploadingAttachments,
    parserHealth,
    pendingAttachments,
    readyAttachmentRefs,
    removePendingAttachment,
  } = useAiAttachments();
  const {
    activeChat,
    availableModels,
    availability,
    chatMode,
    chats,
    currentModel,
    customSystemPrompt,
    deleteChat,
    editAndResendMessage,
    hydrationStatus,
    isTyping,
    lastError,
    liveAssistantMessageId,
    persistenceError,
    regenerateAssistantMessage,
    refreshModels,
    selectChat,
    selectedChatId,
    activeArtifactId,
    includedArtifactIds,
    sendMessage,
    setActiveArtifact,
    setArtifactIncluded,
    setCustomSystemPrompt,
    showTypingIndicator,
    systemPromptContext,
    switchUserMessageVersion,
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
  }, [activeChat, isTyping, selectedChatId]);

  const isModelLoading = availability === 'connecting';
  const openAddModels = () => {
    setModelDropdownOpen(false);
    setAddModelsOpen(true);
  };
  const handleSelectModel = (model: string) => {
    setCurrentModel(model);
    setModelDropdownOpen(false);
  };
  const handleSuggestionClick = (label: string) => setInputValue(getSuggestionPrompt(label));
  const handleDeleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteChat(chatId);
  };
  const handleCopyMessage = async (messageId: string, kind: 'assistant' | 'user') => {
    const message = activeChat?.messages.find((candidate) => candidate.id === messageId);
    if (!message || message.kind !== kind) return;
    await copyTextToClipboard(message.content);
  };
  const handleEditUserMessage = async (messageId: string, nextContent: string) => {
    setInputValue('');
    await editAndResendMessage(messageId, nextContent);
  };
  const handleNewChat = () => {
    setActivePanel('chats');
    selectChat(null);
    if (isMobile) setSidebarOpen(false);
  };
  const handleSend = async () => {
    const nextMessage = inputValue.trim();
    if ((!nextMessage && !readyAttachmentRefs.length) || isTyping || !currentModel) return;
    setInputValue('');
    await sendMessage(nextMessage, readyAttachmentRefs);
    clearReadyAttachments();
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
  const composerProps = {
    availability,
    chatMode,
    currentModel,
    inputValue,
    isModelDropdownOpen: modelDropdownOpen,
    isModelLoading,
    isUploadingAttachments,
    models: availableModels,
    pendingAttachments,
    onAddModels: openAddModels,
    onInputChange: setInputValue,
    onKeyDown: handleKeyDown,
    onRemoveAttachment: removePendingAttachment,
    onSelectFiles: addFiles,
    onSelectModel: handleSelectModel,
    onSend: () => void handleSend(),
    onStop: stopMessage,
    onToggleMode: toggleChatMode,
    onToggleModelDropdown: () => setModelDropdownOpen((open) => !open),
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
        onOpenSettings={() => setSettingsOpen(true)}
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
          <AiStatusBanner
            availability={availability}
            lastError={lastError}
            parserHealth={parserHealth}
            persistenceError={persistenceError}
            onOpenAddModels={openAddModels}
          />
          {hydrationStatus === 'loading' ? (
            <AiWorkspaceLoadingState />
          ) : activeChat ? (
            <ActiveChatView
              activeChat={activeChat}
              currentModel={currentModel}
              liveAssistantMessageId={liveAssistantMessageId}
              showTypingIndicator={showTypingIndicator}
              onCopyAssistantMessage={(messageId) => handleCopyMessage(messageId, 'assistant')}
              onOpenArtifact={(artifactId) => setActiveArtifact(artifactId)}
              onRegenerateAssistantMessage={regenerateAssistantMessage}
              onCopyUserMessage={(messageId) => handleCopyMessage(messageId, 'user')}
              onEditUserMessage={handleEditUserMessage}
              onSwitchUserMessageVersion={switchUserMessageVersion}
            />
          ) : (
            <EmptyState
              {...composerProps}
              isWorking={isTyping}
              onSelectSuggestion={handleSuggestionClick}
            />
          )}
        </div>

        {activeChat && <AiActiveComposer {...composerProps} isTyping={isTyping} />}
      </div>

      <AiArtifactsWorkspace
        activeArtifactId={activeArtifactId}
        chatId={selectedChatId}
        chatUpdatedAt={activeChat?.updatedAt}
        includedArtifactIds={includedArtifactIds}
        onOpenArtifact={setActiveArtifact}
        onSetIncluded={setArtifactIncluded}
      />

      <AiTabOverlays
        addModelsOpen={addModelsOpen}
        availableModels={availableModels}
        chatMode={chatMode}
        customSystemPrompt={customSystemPrompt}
        isPullingModel={isPullingModel}
        pullProgress={pullProgress}
        settingsOpen={settingsOpen}
        tools={systemPromptContext.tools}
        onCloseAddModels={() => setAddModelsOpen(false)}
        onCloseSettings={() => setSettingsOpen(false)}
        onPullModel={handlePullModel}
        onSaveSettings={(value) => {
          setCustomSystemPrompt(value);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
