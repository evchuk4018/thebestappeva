import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { AiTabOverlays } from './ai-tab/AiTabOverlays';
import { AiWorkspacePanel } from './ai-tab/AiWorkspacePanel';
import { copyTextToClipboard } from './ai-tab/clipboard';
import { MobileHeader } from './ai-tab/MobileHeader';
import { pullModel } from './ai-tab/ollama-client';
import { pickSessionTitle } from './ai-tab/session-title';
import { Sidebar } from './ai-tab/Sidebar';
import { AiArtifactsWorkspace } from './ai-tab/AiArtifactsWorkspace';
import { createHandleCopyMessage, createHandleDeleteChat, createHandleEditUserMessage, createHandleKeyDown, createHandleNewChat, createHandlePullModel, createHandleSelectModel, createHandleSend, createSuggestionHandler } from './ai-tab/ai-tab-actions';
import { PullProgress } from './ai-tab/types';
import { useAiAttachments } from './ai-tab/useAiAttachments';
import { useOllamaChat } from './ai-tab/useOllamaChat';
import { useResponsiveSidebar } from './ai-tab/useResponsiveSidebar';

type SidebarPanel = 'chats' | 'tools' | 'skills';

export default function AiTab() {
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<SidebarPanel>('chats');
  const [addModelsOpen, setAddModelsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [isPullingModel, setIsPullingModel] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessionTitle] = useState(pickSessionTitle);
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
    activeProviderOption,
    availableModels,
    availability,
    chatMode,
    chats,
    currentProvider,
    currentModel,
    visionMode,
    customSystemPrompt,
    deleteChat,
    editAndResendMessage,
hydrationStatus,
    isBusy,
    isTyping,
    lastError,
    liveAssistantMessageId,
    persistenceError,
    regenerateAssistantMessage,
    refreshModels,
    runtimeConfig,
    selectChat,
    selectedChatId,
    activeArtifactId,
    activeAskUserStepId,
    includedArtifactIds,
    sendMessage,
    setActiveArtifact,
    setArtifactIncluded,
    setCustomSystemPrompt,
    setProvider,
    setVisionMode,
    showTypingIndicator,
    skills,
    skillsControls,
    systemPromptContext,
    switchUserMessageVersion,
    toggleChatMode,
    setCurrentModel,
    submitAskUserResponse,
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
  const handleSend = createHandleSend({ clearReadyAttachments, currentModel, inputValue, isTyping, readyAttachmentRefs, sendMessage, setInputValue });
  const handleSelectModel = createHandleSelectModel({ runtimeConfig, setCurrentModel, setModelDropdownOpen, setProvider });
  const handleCopyMessage = createHandleCopyMessage({ activeChat, copyTextToClipboard });
  const handleDeleteChat = createHandleDeleteChat({ deleteChat });
  const handleEditUserMessage = createHandleEditUserMessage({ editAndResendMessage, setInputValue });
  const handleNewChat = createHandleNewChat({ isMobile, selectChat, setActivePanel, setSidebarOpen });
  const handleSuggestionClick = createSuggestionHandler(setInputValue);
  const handlePullModel = createHandlePullModel({
    currentProvider,
    pullModel,
    refreshModels,
    setCurrentModel,
    setIsPullingModel,
    setPullProgress,
  });
  const handleKeyDown = createHandleKeyDown(handleSend);
  const handleSelectPanel = (panel: SidebarPanel) => {
    setActivePanel(panel);
    if (panel === 'tools') {
      setSidebarOpen(false);
    }
  };
  const openAddModels = () => {
    if (currentProvider !== 'ollama') {
      return;
    }
    setModelDropdownOpen(false);
    setAddModelsOpen(true);
  };
  const composerProps = {
    availability,
    chatMode,
    currentModel,
    currentProvider,
    inputValue,
    isBusy,
    isModelDropdownOpen: modelDropdownOpen,
    isModelLoading,
    isUploadingAttachments,
    models: availableModels,
    pendingAttachments,
    skills,
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
      <MobileHeader sessionTitle={sessionTitle} sidebarOpen={sidebarOpen} onNewChat={handleNewChat} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
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
        sessionTitle={sessionTitle}
        selectedChatId={selectedChatId}
        sidebarOpen={sidebarOpen}
        hydrationStatus={hydrationStatus}
        persistenceError={persistenceError}
        onClose={() => setSidebarOpen(false)}
        onDeleteChat={handleDeleteChat}
        onNavigateHome={() => navigate('/')}
        onNewChat={handleNewChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectChat={(chatId) => {
          setActivePanel('chats');
          selectChat(chatId);
        }}
        onSelectPanel={handleSelectPanel}
      />

      <div ref={workspaceRef} className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <AiWorkspacePanel
          activePanel={activePanel}
          activeAskUserStepId={activeAskUserStepId}
          activeChat={activeChat}
          availability={availability}
          chatContainerRef={chatContainerRef}
          composerProps={composerProps}
          currentModel={currentModel}
          currentProvider={currentProvider}
          hydrationStatus={hydrationStatus}
          isBusy={isBusy}
          isMobile={isMobile}
          isTyping={isTyping}
          lastError={lastError}
          liveAssistantMessageId={liveAssistantMessageId}
          modelCount={availableModels.length}
          parserHealth={parserHealth}
          persistenceError={persistenceError}
          showTypingIndicator={showTypingIndicator}
          sidebarOpen={sidebarOpen}
          skills={skills}
          skillsError={skillsControls.error}
          skillsLoading={skillsControls.loading}
          tools={tools}
          visionMode={visionMode}
          onCopyAssistantMessage={(messageId) => handleCopyMessage(messageId, 'assistant')}
          onCopyUserMessage={(messageId) => handleCopyMessage(messageId, 'user')}
          onEditUserMessage={handleEditUserMessage}
          onOpenAddModels={openAddModels}
          onOpenArtifact={(artifactId) => setActiveArtifact(artifactId)}
          onOpenSidebar={() => setSidebarOpen(true)}
          onRegenerateAssistantMessage={regenerateAssistantMessage}
          onSelectSuggestion={handleSuggestionClick}
          onSubmitAskUser={submitAskUserResponse}
          onSwitchUserMessageVersion={switchUserMessageVersion}
          onCreateSkill={(request) => skillsControls.create(request)}
          onDeleteSkill={(id) => skillsControls.remove(id)}
          onToggleSkill={(id, enabled) => skillsControls.toggle(id, enabled)}
          onToggleTool={toggleTool}
          onUpdateSkill={(id, request) => skillsControls.update(id, request)}
        />

        <AiArtifactsWorkspace
          activeArtifactId={activeArtifactId}
          chatId={selectedChatId}
          chatUpdatedAt={activeChat?.updatedAt}
          includedArtifactIds={includedArtifactIds}
          onOpenArtifact={setActiveArtifact}
          onSetIncluded={setArtifactIncluded}
          workspaceRef={workspaceRef}
        />
      </div>

      <AiTabOverlays
        addModelsOpen={addModelsOpen}
        allModels={runtimeConfig?.modelOptions ?? availableModels}
        availableModels={availableModels}
        chatMode={chatMode}
        currentModel={currentModel}
        currentProvider={currentProvider}
        visionMode={visionMode}
        customSystemPrompt={customSystemPrompt}
        isPullingModel={isPullingModel}
        pullProgress={pullProgress}
        providerOptions={runtimeConfig?.providerOptions ?? (activeProviderOption ? [activeProviderOption] : [])}
        settingsOpen={settingsOpen}
        skills={skills}
        tools={systemPromptContext.tools}
        onCloseAddModels={() => setAddModelsOpen(false)}
        onCloseSettings={() => setSettingsOpen(false)}
        onPullModel={handlePullModel}
        onSaveSettings={(value) => {
          setCustomSystemPrompt(value.customPrompt);
          setProvider(value.provider, value.model);
          setVisionMode(value.visionMode);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
