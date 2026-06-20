import type { ComponentProps, RefObject } from 'react';
import { PanelLeft } from 'lucide-react';
import { ActiveChatView } from './ActiveChatView';
import { AiActiveComposer } from './AiActiveComposer';
import { AiStatusBanner } from './AiStatusBanner';
import { AiWorkspaceLoadingState } from './AiWorkspaceLoadingState';
import { EmptyState } from './EmptyState';
import { RuntimePill } from './RuntimePill';
import { AutomationsPanel } from './automations/AutomationsPanel';
import { SkillsPanel } from './skills/SkillsPanel';
import { ToolsPanel } from './ToolsPanel';
import type { AskUserResponse, Chat, ModelProvider, OllamaAvailability } from './types';
import type { ToolDefinition } from './tools/types';
import type { AiAttachmentHealth } from '../../../shared/ai-attachments-contract';
import type { AutomationSummary, CreateAutomationRequest, UpdateAutomationRequest } from '../../../shared/automations-contract';
import type { AiVisionMode } from '../../../shared/ai-vision-contract';
import type { CreateSkillRequest, SkillSummary, UpdateSkillRequest } from '../../../shared/skills-contract';

type SidebarPanel = 'chats' | 'tools' | 'skills' | 'automations';
type HydrationStatus = 'loading' | 'ready' | 'error';
type ComposerProps = Omit<ComponentProps<typeof EmptyState>, 'isTyping' | 'onSelectSuggestion'>;

interface WorkspaceTool extends ToolDefinition {
  enabled: boolean;
}

interface AiWorkspacePanelProps {
  activePanel: SidebarPanel;
  activeAskUserStepId: string | null;
  activeChat: Chat | null;
  availability: OllamaAvailability;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  composerProps: ComposerProps;
  currentModel: string | null;
  currentProvider: ModelProvider;
  hydrationStatus: HydrationStatus;
  isBusy: boolean;
  isMobile: boolean;
  isTyping: boolean;
  lastError: string | null;
  liveAssistantMessageId: string | null;
  modelCount: number;
  parserHealth: AiAttachmentHealth | null;
  persistenceError: string | null;
  showTypingIndicator: boolean;
  sidebarOpen: boolean;
  skills: SkillSummary[];
  skillsError: string | null;
  skillsLoading: boolean;
  automations: AutomationSummary[];
  automationsError: string | null;
  automationsLoading: boolean;
  tools: WorkspaceTool[];
  visionMode: AiVisionMode;
  onCopyAssistantMessage: (messageId: string) => Promise<void> | void;
  onCopyUserMessage: (messageId: string) => Promise<void> | void;
  onEditUserMessage: (messageId: string, nextContent: string) => Promise<void> | void;
  onOpenAddModels: () => void;
  onOpenArtifact: (artifactId: string) => void;
  onOpenSidebar: () => void;
  onRegenerateAssistantMessage: (messageId: string) => Promise<void> | void;
  onSelectSuggestion: (label: string) => void;
  onSubmitAskUser: (messageId: string, stepId: string, response: AskUserResponse) => Promise<void> | void;
  onSwitchUserMessageVersion: (messageId: string, direction: 'previous' | 'next') => void;
  onCreateSkill: (request: CreateSkillRequest) => Promise<unknown>;
  onCreateAutomation: (request: CreateAutomationRequest) => Promise<unknown>;
  onDeleteAutomation: (id: string) => Promise<unknown>;
  onDeleteSkill: (id: string) => Promise<unknown>;
  onToggleAutomation: (id: string, enabled: boolean) => Promise<unknown>;
  onToggleSkill: (id: string, enabled: boolean) => Promise<unknown>;
  onToggleTool: (toolId: string, enabled: boolean) => void;
  onUpdateAutomation: (id: string, request: UpdateAutomationRequest) => Promise<unknown>;
  onUpdateSkill: (id: string, request: UpdateSkillRequest) => Promise<unknown>;
}

export function AiWorkspacePanel(props: AiWorkspacePanelProps) {
  const showChatComposer = props.activePanel === 'chats' && props.activeChat;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {!props.sidebarOpen && !props.isMobile && (
        <button
          type="button"
          onClick={props.onOpenSidebar}
          className="absolute left-0 top-4 z-20 rounded-r-xl border border-l-0 border-[#2c2c28] bg-[#20201e] p-2 text-zinc-300 shadow-xl duration-200 hover:text-white"
          title="Open sidebar"
        >
          <PanelLeft size={18} />
        </button>
      )}

      <div className="flex h-16 select-none items-center justify-center pt-3">
        <RuntimePill
          availability={props.availability}
          currentProvider={props.currentProvider}
          visionMode={props.visionMode}
          modelCount={props.modelCount}
          onOpenAddModels={props.onOpenAddModels}
        />
      </div>

      <div ref={props.chatContainerRef} className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pb-32 pt-2 md:px-8">
        <AiStatusBanner
          availability={props.availability}
          currentProvider={props.currentProvider}
          visionMode={props.visionMode}
          lastError={props.lastError}
          parserHealth={props.parserHealth}
          persistenceError={props.persistenceError}
          onOpenAddModels={props.onOpenAddModels}
        />
        {props.activePanel === 'tools' ? (
          <ToolsPanel tools={props.tools} onToggleTool={props.onToggleTool} />
        ) : props.activePanel === 'automations' ? (
          <AutomationsPanel
            automations={props.automations}
            loading={props.automationsLoading}
            error={props.automationsError}
            skills={props.skills}
            onCreate={props.onCreateAutomation}
            onUpdate={props.onUpdateAutomation}
            onToggle={props.onToggleAutomation}
            onDelete={props.onDeleteAutomation}
          />
        ) : props.activePanel === 'skills' ? (
          <SkillsPanel
            skills={props.skills}
            loading={props.skillsLoading}
            error={props.skillsError}
            onCreate={props.onCreateSkill}
            onUpdate={props.onUpdateSkill}
            onToggle={props.onToggleSkill}
            onDelete={props.onDeleteSkill}
          />
        ) : props.hydrationStatus === 'loading' ? (
          <AiWorkspaceLoadingState />
        ) : props.activeChat ? (
          <ActiveChatView
            activeChat={props.activeChat}
            activeAskUserStepId={props.activeAskUserStepId}
            busy={props.isBusy}
            currentProvider={props.currentProvider}
            currentModel={props.currentModel}
            liveAssistantMessageId={props.liveAssistantMessageId}
            showTypingIndicator={props.showTypingIndicator}
            onCopyAssistantMessage={props.onCopyAssistantMessage}
            onOpenArtifact={props.onOpenArtifact}
            onSubmitAskUser={props.onSubmitAskUser}
            onRegenerateAssistantMessage={props.onRegenerateAssistantMessage}
            onCopyUserMessage={props.onCopyUserMessage}
            onEditUserMessage={props.onEditUserMessage}
            onSwitchUserMessageVersion={props.onSwitchUserMessageVersion}
          />
        ) : (
          <EmptyState
            {...props.composerProps}
            isTyping={props.isTyping}
            onSelectSuggestion={props.onSelectSuggestion}
          />
        )}
      </div>

      {showChatComposer && <AiActiveComposer {...props.composerProps} isTyping={props.isTyping} />}
    </div>
  );
}
