import { useState } from 'react';
import { ChatComposer } from './ChatComposer';
import { PromptSuggestions } from './PromptSuggestions';
import type { ChatMode, ModelProvider, OllamaAvailability, OllamaModel } from './types';
import type { PendingAttachment } from './useAiAttachments';
import { pickWorkStatusMessage } from './work-status-messages';
import type { SkillSummary } from '../../../shared/skills-contract';

interface EmptyStateProps {
  availability: OllamaAvailability;
  chatMode: ChatMode;
  currentModel: string | null;
  currentProvider: ModelProvider;
  inputValue: string;
  isBusy: boolean;
  isModelDropdownOpen: boolean;
  isTyping: boolean;
  isModelLoading: boolean;
  isUploadingAttachments: boolean;
  models: OllamaModel[];
  pendingAttachments: PendingAttachment[];
  skills: SkillSummary[];
  onAddModels: () => void;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onRemoveAttachment: (localId: string) => Promise<void> | void;
  onSelectModel: (model: string) => void;
  onSelectSuggestion: (label: string) => void;
  onSend: () => void;
  onSelectFiles: (files: FileList | File[]) => Promise<void> | void;
  onStop: () => void;
  onToggleMode: () => void;
  onToggleModelDropdown: () => void;
}

export function EmptyState(props: EmptyStateProps) {
  const [workStatusMessage] = useState(pickWorkStatusMessage);
  return (
    <div className="my-auto flex w-full max-w-xl flex-col items-center justify-center py-12 text-center md:max-w-2xl md:py-20">
      <div className="mb-6 flex items-center justify-center">
        <div className="relative rounded-3xl border border-[#d97757]/20 bg-[#d97757]/10 p-4">
          <svg className="h-9 w-9 text-[#e2875e]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a1 1 0 0 1 1 1v7.65l6.57-4.78a1 1 0 0 1 1.18 1.62l-6.23 4.53 6.23 4.53a1 1 0 0 1-1.18 1.62L13 14.35V22a1 1 0 0 1-2 0v-7.65l-6.57 4.78a1 1 0 0 1-1.18-1.62l6.23-4.53-6.23-4.53A1 1 0 0 1 4.45 6.5L11 11.28V2a1 1 0 0 1 1-1z" />
          </svg>
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e2875e] opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#e2875e]" />
          </span>
        </div>
      </div>

      <h1 className="mb-3 font-serif text-3xl font-normal tracking-normal text-[#efeae4] md:text-5xl">
        {workStatusMessage}
      </h1>
      <p className="mb-8 max-w-xl text-sm leading-relaxed text-zinc-400">
        {props.currentProvider === 'deepseek'
          ? 'Use the server-side DeepSeek API key from .env while keeping chat, tools, and streaming in the same workspace.'
          : 'Detect installed models, switch between them, and download new ones without leaving the app.'}
      </p>

      <ChatComposer
        availability={props.availability}
        chatMode={props.chatMode}
        currentModel={props.currentModel}
        currentProvider={props.currentProvider}
        inputValue={props.inputValue}
        isBusy={props.isBusy}
        isModelDropdownOpen={props.isModelDropdownOpen}
        isTyping={props.isTyping}
        isModelLoading={props.isModelLoading}
        isUploadingAttachments={props.isUploadingAttachments}
        models={props.models}
        pendingAttachments={props.pendingAttachments}
        skills={props.skills}
        onAddModels={props.onAddModels}
        onInputChange={props.onInputChange}
        onKeyDown={props.onKeyDown}
        onRemoveAttachment={props.onRemoveAttachment}
        onSelectModel={props.onSelectModel}
        onSend={props.onSend}
        onSelectFiles={props.onSelectFiles}
        onStop={props.onStop}
        onToggleMode={props.onToggleMode}
        onToggleModelDropdown={props.onToggleModelDropdown}
      />

      <PromptSuggestions onSelect={props.onSelectSuggestion} />
    </div>
  );
}
