import { ChatModeToggle } from './ChatModeToggle';
import { ArrowRight, Headphones, Mic, Paperclip, Send, Square } from 'lucide-react';
import { useRef } from 'react';
import { ModelPicker } from './ModelPicker';
import type { ChatMode, ModelProvider, OllamaAvailability, OllamaModel } from './types';
import { PendingAttachmentTray } from './PendingAttachmentTray';
import type { PendingAttachment } from './useAiAttachments';
import type { SkillSummary } from '../../../shared/skills-contract';
import { SkillAutocompleteMenu } from './skills/SkillAutocompleteMenu';
import { useSkillAutocomplete } from './skills/useSkillAutocomplete';

interface ChatComposerProps {
  availability: OllamaAvailability;
  chatMode: ChatMode;
  compact?: boolean;
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
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onRemoveAttachment: (localId: string) => Promise<void> | void;
  onSend: () => void;
  onSelectFiles: (files: FileList | File[]) => Promise<void> | void;
  onStop: () => void;
  onSelectModel: (model: string) => void;
  onToggleMode: () => void;
  onToggleModelDropdown: () => void;
}

function readPastedImageFiles(event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
  return Array.from(event.clipboardData.items)
    .filter((item) => item.type.startsWith('image/'))
    .flatMap((item) => {
      const file = item.getAsFile();
      return file ? [file] : [];
    });
}

function getPlaceholder(availability: OllamaAvailability, currentModel: string | null) {
  if (availability === 'connecting') {
    return 'Checking models...';
  }

  if (availability === 'no-models') {
    return 'Install a model to start chatting.';
  }

  if (availability === 'unavailable') {
    return 'Waiting for the selected model to become available...';
  }

  return currentModel ? `Message ${currentModel}...` : 'Select a model to start chatting.';
}

export function ChatComposer({
  availability,
  chatMode,
  compact = false,
  currentModel,
  currentProvider,
  inputValue,
  isBusy,
  isModelDropdownOpen,
  isTyping,
  isModelLoading,
  isUploadingAttachments,
  models,
  pendingAttachments,
  skills,
  onAddModels,
  onInputChange,
  onKeyDown,
  onRemoveAttachment,
  onSend,
  onSelectFiles,
  onStop,
  onSelectModel,
  onToggleMode,
  onToggleModelDropdown,
}: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const autocomplete = useSkillAutocomplete(skills, (nextInput, caret) => {
    onInputChange(nextInput);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) el.setSelectionRange(caret, caret);
    });
  });
  const hasReadyAttachments = pendingAttachments.some((attachment) => attachment.status === 'ready');
  const runtimeUnavailable = availability !== 'ready';
  const isDisabled = (!inputValue.trim() && !hasReadyAttachments) || isBusy || !currentModel || isUploadingAttachments || runtimeUnavailable;
  const isInputDisabled = isBusy || !currentModel || runtimeUnavailable;
  const placeholder = getPlaceholder(availability, currentModel);
  const handlePickFiles = () => fileInputRef.current?.click();

  const handleChange = (value: string) => {
    onInputChange(value);
    const el = inputRef.current;
    autocomplete.update(value, el ? el.selectionStart ?? value.length : value.length);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (autocomplete.handleKeyDown(event)) return;
    onKeyDown(event);
  };

  if (compact) {
    return (
      <div className="w-full rounded-2xl border border-[#2f2f2b] bg-[#20201e] p-2 shadow-2xl focus-within:border-[#e2875e]/60">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) {
              void onSelectFiles(event.target.files);
            }
            event.currentTarget.value = '';
          }}
        />
<PendingAttachmentTray attachments={pendingAttachments} onRemove={onRemoveAttachment} />
        <div className="relative flex flex-col gap-2 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <SkillAutocompleteMenu
              isOpen={autocomplete.isOpen}
              suggestions={autocomplete.suggestions}
              highlighted={autocomplete.highlighted}
              onSelect={autocomplete.select}
            />
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={inputValue}
              disabled={isInputDisabled}
              onChange={(event) => handleChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={(event) => {
                const files = readPastedImageFiles(event);
                if (files.length) {
                  event.preventDefault();
                  void onSelectFiles(files);
                }
              }}
              placeholder={placeholder}
              className="w-full border-none bg-transparent px-3 py-1 text-left text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChatModeToggle disabled={isBusy} mode={chatMode} onToggle={onToggleMode} />
              <ModelPicker
                currentModel={currentModel}
                currentProvider={currentProvider}
                disabled={isBusy}
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
              <button type="button" onClick={handlePickFiles} className="rounded-lg p-1.5 hover:bg-zinc-800 hover:text-zinc-300">
                <Paperclip size={16} />
              </button>
              {isTyping ? (
                <button type="button" onClick={onStop} aria-label="Stop reply" className="rounded-xl bg-[#7f3b31] p-1.5 text-[#fff2eb] hover:bg-[#934338]">
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSend}
                  disabled={isDisabled}
                  className={`rounded-xl p-1.5 ${isDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-650' : 'bg-[#e2875e] text-[#121210] hover:bg-[#d67e5a]'}`}
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 w-full rounded-2xl border border-[#2f2f2b] bg-[#20201e] p-3 duration-200 focus-within:border-[#e2875e]/60 focus-within:shadow-2xl focus-within:shadow-[#e2875e]/5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) {
            void onSelectFiles(event.target.files);
          }
          event.currentTarget.value = '';
        }}
      />
<PendingAttachmentTray attachments={pendingAttachments} onRemove={onRemoveAttachment} />
      <div className="relative">
        <SkillAutocompleteMenu
          isOpen={autocomplete.isOpen}
          suggestions={autocomplete.suggestions}
          highlighted={autocomplete.highlighted}
          onSelect={autocomplete.select}
        />
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={inputValue}
          disabled={isInputDisabled}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(event) => {
            const files = readPastedImageFiles(event);
            if (files.length) {
              event.preventDefault();
              void onSelectFiles(files);
            }
          }}
          placeholder={placeholder}
          className="min-h-[76px] w-full resize-none border-none bg-transparent py-1 text-left text-sm text-zinc-100 outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
        />
      </div>

      <div className="flex items-center justify-between border-t border-[#292925] pt-2">
        <div className="flex items-center gap-1 text-zinc-500">
          <button type="button" onClick={handlePickFiles} className="rounded-xl p-2 duration-150 hover:bg-[#282825] hover:text-zinc-300">
            <Paperclip size={16} />
          </button>
          <button type="button" className="rounded-xl p-2 duration-150 hover:bg-[#282825] hover:text-zinc-300">
            <Mic size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ChatModeToggle disabled={isBusy} mode={chatMode} onToggle={onToggleMode} />
          <ModelPicker
            currentModel={currentModel}
            currentProvider={currentProvider}
            disabled={isBusy}
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
          {isTyping ? (
            <button type="button" onClick={onStop} aria-label="Stop reply" className="rounded-xl bg-[#7f3b31] p-2 text-[#fff2eb] duration-150 hover:bg-[#934338]">
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={isDisabled}
              className={`rounded-xl p-2 duration-150 ${isDisabled ? 'cursor-not-allowed bg-zinc-800 text-zinc-600' : 'bg-[#e2875e] text-[#121210] hover:bg-[#d67e5a]'}`}
            >
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
