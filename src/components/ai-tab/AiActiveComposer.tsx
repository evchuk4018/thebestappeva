import type { KeyboardEvent } from 'react';
import { ChatMode, OllamaAvailability, OllamaModel } from './types';
import { ChatComposer } from './ChatComposer';

interface AiActiveComposerProps {
  availability: OllamaAvailability;
  chatMode: ChatMode;
  currentModel: string | null;
  inputValue: string;
  isModelDropdownOpen: boolean;
  isModelLoading: boolean;
  isTyping: boolean;
  models: OllamaModel[];
  onAddModels: () => void;
  onInputChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectModel: (model: string) => void;
  onSend: () => void;
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
          inputValue={props.inputValue}
          isModelDropdownOpen={props.isModelDropdownOpen}
          isWorking={props.isTyping}
          isModelLoading={props.isModelLoading}
          models={props.models}
          onAddModels={props.onAddModels}
          onInputChange={props.onInputChange}
          onKeyDown={props.onKeyDown}
          onSelectModel={props.onSelectModel}
          onSend={props.onSend}
          onStop={props.onStop}
          onToggleMode={props.onToggleMode}
          onToggleModelDropdown={props.onToggleModelDropdown}
        />
      </div>
    </div>
  );
}
