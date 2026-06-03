import { ChatModeToggle } from './ChatModeToggle';
import { ArrowRight, Headphones, Mic, Paperclip, Send } from 'lucide-react';
import { ModelPicker } from './ModelPicker';
import { ChatMode, OllamaAvailability, OllamaModel } from './types';

interface ChatComposerProps {
  availability: OllamaAvailability;
  chatMode: ChatMode;
  compact?: boolean;
  currentModel: string | null;
  inputValue: string;
  isModelDropdownOpen: boolean;
  isModelLoading: boolean;
  isTyping: boolean;
  models: OllamaModel[];
  onAddModels: () => void;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSend: () => void;
  onSelectModel: (model: string) => void;
  onToggleMode: () => void;
  onToggleModelDropdown: () => void;
}

function getPlaceholder(availability: OllamaAvailability, currentModel: string | null) {
  if (availability === 'connecting') {
    return 'Connecting to local Ollama...';
  }

  if (availability === 'no-models') {
    return 'Install an Ollama model to start chatting.';
  }

  if (availability === 'unavailable') {
    return 'Waiting for local Ollama to become available...';
  }

  return currentModel ? `Message ${currentModel}...` : 'Select a local model to start chatting.';
}

export function ChatComposer({
  availability,
  chatMode,
  compact = false,
  currentModel,
  inputValue,
  isModelDropdownOpen,
  isModelLoading,
  isTyping,
  models,
  onAddModels,
  onInputChange,
  onKeyDown,
  onSend,
  onSelectModel,
  onToggleMode,
  onToggleModelDropdown,
}: ChatComposerProps) {
  const isDisabled = !inputValue.trim() || isTyping || !currentModel;
  const isInputDisabled = isTyping || !currentModel;
  const placeholder = getPlaceholder(availability, currentModel);

  if (compact) {
    return (
      <div className="w-full rounded-2xl border border-[#2f2f2b] bg-[#20201e] p-2 shadow-2xl focus-within:border-[#e2875e]/60">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={inputValue}
              disabled={isInputDisabled}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="w-full border-none bg-transparent px-3 py-1 text-left text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChatModeToggle mode={chatMode} onToggle={onToggleMode} />
              <ModelPicker
                currentModel={currentModel}
                isLoading={isModelLoading}
                isOpen={isModelDropdownOpen}
                models={models}
                onAddModels={onAddModels}
                onClose={onToggleModelDropdown}
                onSelect={onSelectModel}
                onToggle={onToggleModelDropdown}
              />
            </div>
            <div className="flex items-center gap-1.5 text-zinc-500">
              <button type="button" className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-300">
                <Paperclip size={16} />
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={isDisabled}
                className={`rounded-xl p-1.5 ${isDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-650' : 'bg-[#e2875e] text-[#121210] hover:bg-[#d67e5a]'}`}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 w-full rounded-2xl border border-[#2f2f2b] bg-[#20201e] p-3 duration-200 focus-within:border-[#e2875e]/60 focus-within:shadow-2xl focus-within:shadow-[#e2875e]/5">
      <textarea
        value={inputValue}
        disabled={isInputDisabled}
        onChange={(event) => onInputChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="min-h-[76px] w-full resize-none border-none bg-transparent py-1 text-left text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
      />

      <div className="flex items-center justify-between border-t border-[#292925] pt-2">
        <div className="flex items-center gap-1 text-zinc-500">
          <button type="button" className="rounded-xl p-2 duration-150 hover:bg-[#282825] hover:text-zinc-300">
            <Paperclip size={16} />
          </button>
          <button type="button" className="rounded-xl p-2 duration-150 hover:bg-[#282825] hover:text-zinc-300">
            <Mic size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ChatModeToggle mode={chatMode} onToggle={onToggleMode} />
          <ModelPicker
            currentModel={currentModel}
            isLoading={isModelLoading}
            isOpen={isModelDropdownOpen}
            models={models}
            onAddModels={onAddModels}
            onClose={onToggleModelDropdown}
            onSelect={onSelectModel}
            onToggle={onToggleModelDropdown}
          />
          <button type="button" className="rounded-xl p-2 text-zinc-500 duration-150 hover:bg-[#282825] hover:text-zinc-300">
            <Headphones size={16} />
          </button>
          <button
            type="button"
            onClick={onSend}
            disabled={isDisabled}
            className={`rounded-xl p-2 duration-150 ${
              isDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-600' : 'bg-[#e2875e] text-[#121210] hover:bg-[#d67e5a]'
            }`}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
