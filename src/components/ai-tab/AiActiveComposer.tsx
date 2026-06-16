import type { KeyboardEvent } from 'react';
import type { ChatMode, ModelProvider, OllamaAvailability, OllamaModel } from './types';
import { ChatComposer } from './ChatComposer';
import type { PendingAttachment } from './useAiAttachments';

interface AiActiveComposerProps {
  availability: OllamaAvailability;
  chatMode: ChatMode;
  currentModel: string | null;
  currentProvider: ModelProvider;
  inputValue: string;
  isBusy: boolean;
  isModelDropdownOpen: boolean;
  isModelLoading: boolean;
  isTyping: boolean;
  isUploadingAttachments: boolean;
  models: OllamaModel[];
  pendingAttachments: PendingAttachment[];
  onAddModels: () => void;
  onInputChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onRemoveAttachment: (localId: string) => Promise<void> | void;
  onSelectModel: (model: string) => void;
  onSend: () => void;
  onSelectFiles: (files: FileList | File[]) => Promise<void> | void;
  onStop: () => void;
  onToggleMode: () => void;
  onToggleModelDropdown: () => void;
}

export function AiActiveComposer(props: AiActiveComposerProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center border-t border-[#242422]/60 bg-[#1b1b19] px-4 py-4 md:px-8">
      <div className="w-full max-w-xl md:max-w-2xl">
        <ChatComposer
          availability={props.availability}
          chatMode={props.chatMode}
          compact
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
      </div>
    </div>
  );
}
